import { InternalContext } from "../../context";
import { DefaultContext } from "../../shared-context";

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
      Object.values(database.sqlModules).flatMap((module) => ({
        database,
        module,
      }))
  );
  // process any given sql module by asking it's owning database to execute it
  // each module has a `contextName` which is a nice key to use in this module Map
  rootContext.sqlModuleExecutors = Object.fromEntries(
    allSQLModules.map((dbModule) => [
      dbModule.module.contextName,
      {
        sqlModule: dbModule.module,
        executor: async (context: DefaultContext): Promise<DefaultContext> => {
          context.results = await dbModule.database.execute(
            dbModule.module,
            context.parameters
          );
          return context;
        },
      },
    ])
  );
  // collect all the autocrud modules
  const allAutocrudModules = Object.values(rootContext.databases).flatMap(
    (database) =>
      Object.values(database.autocrudModules).flatMap((module) => ({
        database,
        module,
      }))
  );
  // wire up an executor for each autocrud module
  rootContext.autocrudModuleExecutors = Object.fromEntries(
    allAutocrudModules.map((dbModule) => [
      dbModule.module.contextName,
      {
        autocrudModule: dbModule.module,
        executor: async (context: DefaultContext): Promise<DefaultContext> => {
          throw new Error("Not Implemented" + context);
        },
      },
    ])
  );

  return rootContext;
};
