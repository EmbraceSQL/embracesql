import { InternalContext, DatabaseInternalWithModules } from "../../context";
import {
  AutocrudModule,
  DefaultContext,
  SQLParameterSet,
  isSQLParameterSetBatch,
  SQLParameterSetBatch,
  isSQLParameterSet,
} from "../../shared-context";
import { identifier } from "..";
import { validParameters } from "../../database-engines";

/**
 * Generate a delete method. This will generate another autocrud
 * module and add it to the database.
 *
 * This will accept and entire record of parameters, and return
 * the primary key. The key will just be returned from what is passed.
 */
export default async (
  rootContext: InternalContext,
  database: DatabaseInternalWithModules,
  autocrudModule: AutocrudModule
): Promise<InternalContext> => {
  // create
  const restPath = `${autocrudModule.restPath}/delete`;
  const deleteModule = (database.autocrudModules[restPath] = {
    ...autocrudModule,
    contextName: identifier(`${database.name}/${restPath}`),
    restPath,
    namedParameters: autocrudModule.keys,
    // empty return -- we did delete it after all
    columns: [],
    resultsetMetadata: [],
    canModifyData: true,
  });
  // and with an executor to run the thing
  rootContext.autocrudModuleExecutors[deleteModule.contextName] = {
    autocrudModule: deleteModule,
    executor: async (context: DefaultContext): Promise<DefaultContext> => {
      const queries = await database.deleteSQL(deleteModule);
      const doOne = async (parameters: SQLParameterSet): Promise<void> => {
        // limit to the desired parameters to be forgiving
        parameters = Object.fromEntries(
          deleteModule.namedParameters.map((p) => [p.name, parameters[p.name]])
        );
        // make the row -- nothing to read here
        await database.execute(
          queries.byKey,
          validParameters(deleteModule, parameters)
        );
      };
      if (isSQLParameterSetBatch(context.parameters)) {
        await Promise.all(
          (context.parameters as SQLParameterSetBatch).map(doOne)
        );
      } else if (isSQLParameterSet(context.parameters)) {
        await doOne(context.parameters);
      } else {
        throw new Error("no parameters");
      }
      // results should be empty
      context.results = [];
      return context;
    },
  };
  return rootContext;
};
