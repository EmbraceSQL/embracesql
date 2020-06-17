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
  const updateModule = (database.modules[restPath] = {
    ...autocrudModule,
    contextName: identifier(`${database.name}/${restPath}`),
    restPath,
    // every column is a parameter in a full update
    namedParameters: autocrudModule.columns,
    // inserted columns will be 1-1 with parameters
    workOnTheseColumns: otherThanKeys,
    // read back the keys
    resultsetMetadata: autocrudModule.keys,
    canModifyData: true,
  });
  // and with an executor to run the thing
  const queries = await database.updateSQL(updateModule);
  rootContext.moduleExecutors[updateModule.contextName] = {
    module: updateModule,
    executor: async (context: Context): Promise<Context> => {
      const updateOne = async (
        parameters: SQLParameterSet
      ): Promise<SQLRow> => {
        // make the row -- nothing to read here
        await database.execute(
          queries.byKey,
          validParameters(updateModule, parameters)
        );
        return parameters;
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
