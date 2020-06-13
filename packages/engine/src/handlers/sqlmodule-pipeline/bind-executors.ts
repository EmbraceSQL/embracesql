import { InternalContext, DatabaseInternal } from "../../context";
import { Context } from "../../shared-context";
import { SQLModuleInternal } from ".";

/**
 * Direct query exeuction for every module on every database. This is the 'middle'
 * or 'core' of exuting a SQL module, this meat inside the bun of the
 * event handlers.
 */
export default async (
  rootContext: InternalContext,
  database: DatabaseInternal,
  sqlModule: SQLModuleInternal
): Promise<InternalContext> => {
  rootContext.sqlModuleExecutors[sqlModule.contextName] = {
    sqlModule: sqlModule,
    executor: async (context: Context): Promise<Context> => {
      context.results = await database.execute(
        sqlModule.sql,
        context.parameters
      );
      return context;
    },
  };

  return rootContext;
};
