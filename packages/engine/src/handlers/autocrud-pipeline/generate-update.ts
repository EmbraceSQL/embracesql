import {
  InternalContext,
  DatabaseInternalWithModules,
} from "../../internal-context";
import {
  AutocrudModule,
  Context,
  SQLRow,
  SQLParameterSet,
} from "../../shared-context";
import { identifier } from "..";
import { validParameters } from "../../database-engines";

/**
 * Generate an update method. This will generate another autocrud
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
  const restPath = `${autocrudModule.restPath}/update`;
  // the fields to update -- things other than keys
  const otherThanKeys = autocrudModule.columns.filter(
    (column) => !autocrudModule.keys.map((c) => c.name).includes(column.name)
  );
  const module = (database.modules[restPath] = {
    ...autocrudModule,
    contextName: identifier(`${database.name}/${restPath}`),
    restPath,
    // every column is a parameter in a full update
    namedParameters: autocrudModule.columns,
    // read back the keys
    resultsetMetadata: autocrudModule.keys,
    canModifyData: true,
  }); // COALESCE to just save the existing value, this means this is a full record update
  const columnUpdates = otherThanKeys
    .map((c) => `${c.name} = COALESCE(:${c.name}, ${c.name})`)
    .join(",");
  const keyFilter = module.keys
    .map((c) => `${c.name} = :${c.name}`)
    .join(" AND ");
  const updateByKey = `UPDATE ${module.name} SET ${columnUpdates} WHERE ${keyFilter}`;
  // and with an executor to run the thing
  rootContext.moduleExecutors[module.contextName] = {
    module,
    executor: async (context: Context): Promise<Context> => {
      const updateOne = async (
        parameters: SQLParameterSet
      ): Promise<SQLRow> => {
        // make the row -- nothing to read here
        const validatedParameters = validParameters(module, parameters);
        await database.execute(updateByKey, validatedParameters);
        return validatedParameters;
      };
      if (context.parameters.length) {
        const updates = context.parameters.map(updateOne);
        context.results = await Promise.all(updates);
      } else {
        throw new Error("no parameters");
      }

      return context;
    },
  };
  return rootContext;
};
