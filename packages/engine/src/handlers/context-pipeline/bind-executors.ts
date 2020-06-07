import { InternalContext } from "../../context";
import { SQLParameters, SQLRow } from "../../shared-context";

/**
 * Direct query exeuction for every module on every database. This is the 'middle'
 * or 'core' of exuting a SQL module, this meat inside the bun of the
 * event handlers.
 */
export default async (
  rootContext: InternalContext
): Promise<InternalContext> => {
  // collect every sql module in every database
  const allSQLModules = Object.values(rootContext.databases).flatMap(
    (database) =>
      Object.values(database.SQLModules).flatMap((sqlModule) => ({
        database,
        sqlModule,
      }))
  );
  // process any given sql module by asking it's owning database to execute it
  // each module has a `contextName` which is a nice key to use in this module Map
  rootContext.directQueryExecutors = Object.fromEntries(
    allSQLModules.map((dbModule) => [
      dbModule.sqlModule.contextName,
      async (parameters: SQLParameters): Promise<SQLRow[]> =>
        dbModule.database.execute(dbModule.sqlModule, parameters),
    ])
  );
  return rootContext;
};
