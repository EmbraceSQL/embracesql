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
  const module = (database.modules[restPath] = {
    ...autocrudModule,
    contextName: identifier(`${database.name}/${restPath}`),
    restPath,
    namedParameters: autocrudModule.keys,
    // empty return -- we did delete it after all
    resultsetMetadata: [],
    canModifyData: true,
  });
  // generic SQL
  const keyFilter = module.namedParameters
    .map((c) => `${c.name} = :${c.name}`)
    .join(" AND ");
  const deleteByKeys = `DELETE FROM ${module.name} WHERE ${keyFilter}`;
  // and with an executor to run the thing
  rootContext.moduleExecutors[module.contextName] = {
    database,
    module,
    executor: async (context: Context): Promise<Context> => {
      const doOne = async (parameters: SQLParameterSet): Promise<SQLRow> => {
        // make the row -- nothing to read here
        const validatedParameters = validParameters(module, parameters);
        await database.execute(
          deleteByKeys,
          validParameters(module, parameters)
        );
        return validatedParameters;
      };
      if (context.parameters.length) {
        context.results = await Promise.all(context.parameters.map(doOne));
      } else {
        throw new Error("no parameters");
      }
      // just return the parameters used, may be handy for chaining
      return context;
    },
  };
  return rootContext;
};
