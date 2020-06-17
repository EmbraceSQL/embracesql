import { InternalContext, DatabaseInternal } from "../../internal-context";
import {
  Context,
  SQLParameterSet,
  SQLRow,
  isSQLParameterSetBatch,
  isSQLParameterSet,
} from "../../shared-context";
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
    module: sqlModule,
    executor: async (context: Context): Promise<Context> => {
      const doOne = async (parameters: SQLParameterSet): Promise<SQLRow[]> => {
        return await database.execute(sqlModule.sql, parameters);
      };
      if (isSQLParameterSetBatch(context.parameters)) {
        const updates = (context.parameters as SQLParameterSet[]).map(doOne);
        context.results = (await Promise.all(updates)).flat(1);
      } else if (isSQLParameterSet(context.parameters)) {
        context.results = await doOne(context.parameters);
      } else {
        // this is the undefined / empty case
        context.results = await doOne({});
      }
      return context;
    },
  };

  return rootContext;
};
