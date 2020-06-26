import { InternalContext, DatabaseInternal } from "../../internal-context";
import { Context, SQLParameterSet, SQLRow } from "../../shared-context";
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
  rootContext.moduleExecutors[sqlModule.contextName] = {
    database,
    module: sqlModule,
    executor: async (context: Context): Promise<Context> => {
      const doOne = async (parameters: SQLParameterSet): Promise<SQLRow[]> => {
        return await database.execute(sqlModule.sql, parameters);
      };
      if (context.parameters.length) {
        const updates = [...context.parameters].map(doOne);
        context.results = (await Promise.all(updates)).flat(1);
      } else {
        // this is the undefined / empty case
        context.results = await doOne({});
      }
      return context;
    },
  };

  return rootContext;
};
