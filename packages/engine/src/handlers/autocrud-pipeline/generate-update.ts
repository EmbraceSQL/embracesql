import { InternalContext, DatabaseInternalWithModules } from "../../context";
import {
  AutocrudModule,
  DefaultContext,
  SQLRow,
  SQLParameterSet,
  isSQLParameterSetBatch,
  SQLParameterSetBatch,
  isSQLParameterSet,
} from "../../shared-context";
import { identifier } from "..";

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
  // create
  const restPath = `${autocrudModule.restPath}/update`;
  // the input parameters -- are the schema minus any autoincrement
  const namedParameters = autocrudModule.columns.filter(
    (column) =>
      !autocrudModule.autoColumns.map((c) => c.name).includes(column.name)
  );
  const createModule = (database.autocrudModules[restPath] = {
    ...autocrudModule,
    contextName: identifier(`${database.name}/${restPath}`),
    restPath,
    namedParameters,
    // inserted columns will be 1-1 with parameters
    columns: namedParameters,
    // read back the keys
    resultsetMetadata: autocrudModule.keys,
    canModifyData: true,
  });
  // and with an executor to run the thing
  rootContext.autocrudModuleExecutors[createModule.contextName] = {
    autocrudModule: createModule,
    executor: async (context: DefaultContext): Promise<DefaultContext> => {
      const queries = await database.updateSQL(createModule);
      const updateOne = async (
        parameters: SQLParameterSet
      ): Promise<SQLRow> => {
        // make the row -- nothing to read here
        await database.execute(queries.byKey, parameters);
        return parameters;
      };
      if (isSQLParameterSetBatch(context.parameters)) {
        const updates = (context.parameters as SQLParameterSetBatch).map(
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
