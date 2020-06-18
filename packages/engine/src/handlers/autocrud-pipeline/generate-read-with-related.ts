import {
  InternalContext,
  DatabaseInternalWithModules,
} from "../../internal-context";
import {
  AutocrudModule,
  Context,
  SQLParameterSet,
  SQLRow,
} from "../../shared-context";
import { identifier } from "..";
import { nestedTableName } from "../../database-engines";



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
    resultsetMetadata: autocrudModule.columns,
    canModifyData: false,
  });
  rootContext.moduleExecutors[module.contextName] = {
    module,
    executor: async (context: Context): Promise<Context> => {
      const doOne = async (parameters: SQLParameterSet): Promise<SQLRow[]> => {
        // starting from 'this' table, build up a sql 'batch' -- a list
        // of statements, the first of which gets paraeterized by the key
        // we'll be getting all the columns each time -- so let's just use *
        // this is also going to make use of temp tables which will
        // cut down on parameters
        const drops = new Array<string>();

        // this is recursive along the graph, so there will need to be a
        // cycle detector
        const cycleDetector = new Set<string>();
        console.assert(cycleDetector);

        const coreRecordTable = `_${nestedTableName(autocrudModule)}`;
        const coreRecordSQL = `CREATE TEMPORARY TABLE ${coreRecordTable} AS SELECT * FROM ${autocrudModule.name} WHERE ${keyWhere};`;
        drops.push(coreRecordTable);
        await database.execute(coreRecordSQL, parameters);

        return [];
      };
      if (context.parameters.length) {
        // lots of ways to implement this, let's do the naive one for the moment
        const resultSets = context.parameters.map(doOne);
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
