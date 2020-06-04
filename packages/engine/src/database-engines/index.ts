import embraceSQLite from "./sqlite";
import { AllDatabasesInternal } from "../context";
import { DatabaseInternal } from "../context";
import pLimit from "p-limit";
import {
  SQLModule,
  SQLColumnMetadata,
  SQLRow,
  SQLParameters,
} from "../shared-context";
import { SQLModuleInternal } from "../event-handlers/sqlmodule-pipeline";
import { Configuration } from "../configuration";

/**
 * Serialize database use per process as we really only have one connection.
 */
const oneAtATime = pLimit(1);

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
  const dbUrl = configuration?.databases[databaseName];
  switch (dbUrl.protocol.split(":")[0].toLowerCase()) {
    case "sqlite":
      return embraceSQLite(configuration, databaseName);
    default:
      return undefined;
  }
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
  Object.keys(configuration.databases).forEach(async (databaseName) => {
    const database = await embraceSingleDatabase(configuration, databaseName);
    databases[databaseName] = {
      ...database,
      // here is wrapping the individual database driver execute and analyze
      // with a throttled promise limit -- since we have only one connection
      // these are not re-entrant
      execute: async (
        sqlModule: SQLModule,
        parameters?: SQLParameters
      ): Promise<SQLRow[]> => {
        const results = await oneAtATime(() =>
          database.execute(sqlModule, parameters)
        );
        return results as SQLRow[];
      },
      analyze: async (
        sqlModule: SQLModuleInternal
      ): Promise<SQLColumnMetadata[]> => {
        const results = await oneAtATime(() => database.analyze(sqlModule));
        return results as SQLColumnMetadata[];
      },
    };
  });
  return databases;
};
