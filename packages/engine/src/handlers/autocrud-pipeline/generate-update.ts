import { InternalContext, DatabaseInternalWithModules } from "../../context";
import {
  AutocrudModule,
  Context,
  SQLRow,
  SQLParameterSet,
  isSQLParameterSetBatch,
  isSQLParameterSet,
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
  autocrudModule.canModifyData = true;
  // the fields to update -- things other than keys
  const otherThanKeys = autocrudModule.columns.filter(
    (column) => !autocrudModule.keys.map((c) => c.name).includes(column.name)
  );
  const updateModule = (database.autocrudModules[restPath] = {
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
  rootContext.autocrudModuleExecutors[updateModule.contextName] = {
    autocrudModule: updateModule,
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
      if (isSQLParameterSetBatch(context.parameters)) {
        const updates = (context.parameters as SQLParameterSet[]).map(
          updateOne
        );
        context.results = await Promise.all(updates);
      } else if (isSQLParameterSet(context.parameters)) {
        context.results = [await updateOne(context.parameters)];
      } else {
        throw new Error("no parameters");
      }

      return context;
    },
  };
  return rootContext;
};
