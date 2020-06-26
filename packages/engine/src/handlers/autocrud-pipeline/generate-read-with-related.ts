import {
  InternalContext,
  DatabaseInternalWithModules,
} from "../../internal-context";
import {
  AutocrudModule,
  Context,
  SQLParameterSet,
  SQLRow,
  SQLTableMetadata,
  SQLColumnMetadata,
} from "../../shared-context";
import { identifier } from "..";
import { nestedTableName, schemaQualifiedName } from "../../database-engines";
import { ArrayListMultimap } from "../../multimap";

/**
 * Generate the return / record type based on the relationships and related data.
 *
 */
export const generateResultsetMetadata = (
  autocrudModule: AutocrudModule
): SQLColumnMetadata[] => {
  const cycleDetector = new Set<string>();
  const followTheGraph = (
    table: SQLTableMetadata,
    coreResultset: SQLColumnMetadata[]
  ): SQLColumnMetadata[] => {
    // first out of the gate -- prevent infinite recursion
    if (cycleDetector.has(schemaQualifiedName(table))) return [];
    cycleDetector.add(schemaQualifiedName(table));
    for (const related of table.relatedData) {
      if (!cycleDetector.has(schemaQualifiedName(related.toTable))) {
        // this nested record is a sub-record
        const nestedRecord = {
          name: nestedTableName(related.toTable),
          type: followTheGraph(related.toTable, [...related.toTable.columns]),
        };
        coreResultset.push(nestedRecord);
      }
    }
    return coreResultset;
  };
  return followTheGraph(autocrudModule, [...autocrudModule.columns]);
};

/**
 * Generate a read method -- along with related data along the referential graph.
 *
 * This is variadic -- and will read from a colleciton of keys.
 *
 * There is no 'read all' related.
 */
export default async (
  rootContext: InternalContext,
  database: DatabaseInternalWithModules,
  autocrudModule: AutocrudModule
): Promise<InternalContext> => {
  // quick check - if there are no related record, do not generate
  if (autocrudModule.relatedData.length === 0) return rootContext;

  // now then, on with the show of the related data reader
  const restPath = `${autocrudModule.restPath}/readWithRelated`;

  // computing the result-set is the big implementation challenge
  // because a record/row can contain 'nested' records/rows
  // we'll adopt a really simple protocol that calls the relationship
  // by the 'to' file name, with its rows inside

  const keyWhere = autocrudModule.keys
    .map((k) => `${k.name} = :${k.name}`)
    .join(" AND ");

  const module = (database.modules[restPath] = {
    ...autocrudModule,
    contextName: identifier(`${database.name}/${restPath}`),
    restPath,
    namedParameters: autocrudModule.keys,
    resultsetMetadata: generateResultsetMetadata(autocrudModule),
    canModifyData: false,
  });
  // build up the execution function
  rootContext.moduleExecutors[module.contextName] = {
    database,
    module,
    executor: async (context: Context): Promise<Context> => {
      const doOne = async (parameters: SQLParameterSet): Promise<SQLRow[]> => {
        // multiple database reads, so make this atomic
        return database.atomic(async () => {
          // starting from 'this' table, build up a sql 'batch' -- a list
          // of statements, the first of which gets paraeterized by the key
          // we'll be getting all the columns each time -- so let's just use *
          // this is also going to make use of temp tables which will
          // cut down on parameters
          const drops = new Array<string>();

          // this is recursive along the graph, so there will need to be a
          // cycle detector
          const cycleDetector = new Set<string>();

          // bootstrap the root table -- this has parameters
          const coreRecordTable = `_${nestedTableName(module)}`;
          const coreRecordSQL = `CREATE TEMPORARY TABLE ${coreRecordTable} AS SELECT * FROM ${schemaQualifiedName(
            module
          )} WHERE ${keyWhere};`;
          await database.execute(coreRecordSQL, parameters);

          const followTheGraph = async (
            table: SQLTableMetadata
          ): Promise<SQLRow[]> => {
            // first out of the gate -- prevent infinite recursion
            if (cycleDetector.has(schemaQualifiedName(table))) return [];
            cycleDetector.add(schemaQualifiedName(table));

            const coreRecordTable = `_${nestedTableName(table)}`;
            drops.push(coreRecordTable);

            // and the actual data
            const coreRecords = await database.execute(
              `SELECT * FROM ${coreRecordTable}`,
              {}
            );

            // and here the tricky part starts, loop through the related data
            // fetch it -- and then join in memory
            for (const related of table.relatedData) {
              // relationships are bidirectional -- so you need to check if this table
              // has already been processed
              if (!cycleDetector.has(schemaQualifiedName(related.toTable))) {
                const relatedRecordTable = `_${nestedTableName(
                  related.toTable
                )}`;
                const joinZip = related.joinColumns.map((c, i) => ({
                  fromColumn: c,
                  toColumn: related.toTableJoinColumns[i],
                }));
                const joinClause = joinZip
                  .map(
                    ({ fromColumn, toColumn }) =>
                      `${coreRecordTable}.${
                        fromColumn.name
                      } = ${schemaQualifiedName(related.toTable)}.${
                        toColumn.name
                      }`
                  )
                  .join(" AND ");
                // temp table join to create -- more data that is related
                const relatedRecordSQL = `
                CREATE TEMPORARY TABLE ${relatedRecordTable} 
                AS
                SELECT ${schemaQualifiedName(related.toTable)}.*
                FROM ${schemaQualifiedName(related.toTable)} 
                INNER JOIN ${coreRecordTable} 
                ON ${joinClause}
              `;
                await database.execute(relatedRecordSQL, {});
                // temp is created, this is a level deeper, but in the same state -- temp created
                // and not yet selected out so it is time to recurse
                const relatedRecords = await followTheGraph(related.toTable);
                // and here is an in memory join -- let's use a hash join on a compounded key
                // using multimaps to allow many-many joins
                const coreMap = new ArrayListMultimap<string, SQLRow>();
                for (const record of coreRecords) {
                  coreMap.put(
                    Object.keys(record)
                      .filter((n) =>
                        related.joinColumns.map((c) => c.name).includes(n)
                      )
                      .sort()
                      .map((n) => record[n].toString())
                      .join("."),
                    record
                  );
                }
                const relatedMap = new ArrayListMultimap<string, SQLRow>();
                for (const record of relatedRecords) {
                  relatedMap.put(
                    Object.keys(record)
                      .filter((n) =>
                        related.toTableJoinColumns
                          .map((c) => c.name)
                          .includes(n)
                      )
                      .sort()
                      .map((n) => record[n].toString())
                      .join("."),
                    record
                  );
                }
                // whew -- setup is complete -- now let's join!
                for (const relatedKey of relatedMap.keys()) {
                  // iteration here is to allow many-many joins
                  for (const coreRecord of coreMap.get(relatedKey)) {
                    // and just stuff the related record on as a nested table
                    coreRecord[
                      nestedTableName(related.toTable)
                    ] = relatedMap.get(relatedKey);
                  }
                }
              }
            }
            // now we have nested records joined if needed, and are 'done'
            return coreRecords;
          };
          // start the recursion
          const joinedUp = await followTheGraph(module);
          // and clean up after ourselves
          for (const drop of drops) {
            await database.execute(`DROP TABLE ${drop};`);
          }
          return joinedUp;
        });
      };
      if (context.parameters.length) {
        // lots of ways to implement this, let's do the naive one for the moment
        const resultSets = [...context.parameters].map(doOne);
        // flatten out a bit so this looks like a result set
        context.results = (await Promise.all(resultSets)).flat(2);
      } else {
        throw new Error("no parameters");
      }
      return context;
    },
  };
  return rootContext;
};
