import embraceSQLite from "./sqlite";
import { AllDatabasesInternal } from "../internal-context";
import { DatabaseInternal } from "../internal-context";
import pLimit from "p-limit";
import {
  SQLColumnMetadata,
  SQLRow,
  Configuration,
  CommonDatabaseModule,
  SQLTableMetadata,
  SQLParameterSet,
} from "../shared-context";
import { SQLModuleInternal } from "../handlers/sqlmodule-pipeline";
import Url from "url-parse";
import graphlib from "graphlib";

/**
 * Serialize database use per process as we really only have one connection.
 */
const oneAtATime = pLimit(1);

/**
 * Filter to just the declared parameters. This lets callers be a little sloppy
 * and things will still 'just work'.
 */
export const validParameters = (
  module: CommonDatabaseModule,
  parameters: SQLParameterSet
): SQLParameterSet =>
  Object.fromEntries(
    module.namedParameters.map((p) => [p.name, parameters[p.name]])
  );

/**
 * Embrace a database, bringing it into context.
 *
 * TODO: this needs a wrapper around each database to try to heal itself
 * and reconnect, or to fault and let the container worker process end.
 */
const embraceSingleDatabase = async (
  configuration: Configuration,
  databaseName: string
): Promise<DatabaseInternal> => {
  const dbUrl = new Url(configuration.databases[databaseName]);
  switch (dbUrl.protocol.split(":")[0].toLowerCase()) {
    case "sqlite":
      return embraceSQLite(configuration, databaseName, dbUrl);
    default:
      return undefined;
  }
};

/**
 * Referential graph. This is undirected, relationships are considered
 * symmetric even though the SQL references clause it actually directed.
 *
 * Reason being -- 1-man-1 joiner tables, those joiners 'reference' the parent, compared
 * to lookup value type tables where the parent references the child.
 *
 * And -- master detail 1-many, the child references the parent, but you will
 * want to get all the children along with a fetch of a parent to build screens
 * in actual practice.
 */
export const buildReferentialGraph = async (
  tables: SQLTableMetadata[]
): Promise<void> => {
  // each table is a node, each reference is an undirected edge
  const graph = new graphlib.Graph({ multigraph: true, directed: false });
  for (const table of tables) {
    graph.setNode(`${table.schema}.${table.name}`, table);
    for (const reference of table.references) {
      graph.setEdge(
        `${table.schema}.${table.name}`,
        `${reference.toSchema}.${reference.toTable}`,
        reference
      );
    }
  }
  for (const table of tables) {
    // each table has neighbors, and those neighbors may reference
    // this table -- or may be referenced by this table -- the two and from swapped
    // let's call these `backreferences` -- and collect them here
    const neighbors =
      (graph.neighbors(`${table.schema}.${table.name}`) as string[]) || [];
    for (const key of neighbors) {
      const neighbor = graph.node(key) as SQLTableMetadata;
      for (const reference of neighbor.references) {
        if (
          reference.toSchema === table.schema &&
          reference.toTable === table.name
        ) {
          // reverse the reference
          table.backReferences.push({
            fromSchema: table.schema,
            fromTable: table.name,
            fromColumns: reference.toColumns,
            toSchema: reference.fromSchema,
            toTable: reference.fromTable,
            toColumns: reference.fromColumns,
          });
        }
      }
    }
  }
  // at this point -- the schema metadata itself is bidirectionally 'linked' with
  // references and back references
  return;
};

/**
 * Every database in the configuraton is embraced and brought into the context.
 */
export const embraceDatabases = async (
  configuration: Configuration
): Promise<AllDatabasesInternal> => {
  // name value pairs inside the root context -- there isn't a strongly
  // typed generated context type available to the generator itself
  const databases = {};
  for (const databaseName in configuration.databases) {
    const database = await embraceSingleDatabase(configuration, databaseName);
    databases[databaseName] = {
      ...database,
      modules: {},
      // here is wrapping the individual database driver execute and analyze
      // with a throttled promise limit -- since we have only one connection
      // these are not re-entrant
      execute: async (
        sql: string,
        parameters?: SQLParameterSet
      ): Promise<SQLRow[]> => {
        return oneAtATime(() => database.execute(sql, parameters));
      },
      analyze: async (
        sqlModule: SQLModuleInternal
      ): Promise<SQLColumnMetadata[]> => {
        return oneAtATime(() => database.analyze(sqlModule));
      },
    };
  }
  return databases;
};
