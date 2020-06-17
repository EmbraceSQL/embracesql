import {
  InternalContext,
  DatabaseInternalWithModules,
} from "../../internal-context";
import {
  AutocrudModule,
  Context,
  SQLParameterSet,
  isSQLParameterSetBatch,
  isSQLParameterSet,
  SQLRow,
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
  const restPath = `${autocrudModule.restPath}/delete`;
  const deleteModule = (database.modules[restPath] = {
    ...autocrudModule,
    contextName: identifier(`${database.name}/${restPath}`),
    restPath,
    namedParameters: autocrudModule.keys,
    workOnTheseColumns: [],
    // empty return -- we did delete it after all
    resultsetMetadata: [],
    canModifyData: true,
  });
  // and with an executor to run the thing
  const queries = await database.deleteSQL(deleteModule);
  rootContext.moduleExecutors[deleteModule.contextName] = {
    module: deleteModule,
    executor: async (context: Context): Promise<Context> => {
      const doOne = async (parameters: SQLParameterSet): Promise<SQLRow> => {
        // limit to the desired parameters to be forgiving
        parameters = Object.fromEntries(
          deleteModule.namedParameters.map((p) => [p.name, parameters[p.name]])
        );
        // make the row -- nothing to read here
        const validatedParameters = validParameters(deleteModule, parameters);
        await database.execute(queries.byKey, validatedParameters);
        return validatedParameters;
      };
      if (isSQLParameterSetBatch(context.parameters)) {
        context.results = await Promise.all(
          (context.parameters as SQLParameterSet[]).map(doOne)
        );
      } else if (isSQLParameterSet(context.parameters)) {
        context.results = [await doOne(context.parameters)];
      } else {
        throw new Error("no parameters");
      }
      // just return the parameters used, may be handy for chaining
      return context;
    },
  };
  return rootContext;
};
