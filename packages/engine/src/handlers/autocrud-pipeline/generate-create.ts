import { InternalContext, DatabaseInternalWithModules } from "../../context";
import { AutocrudModule, DefaultContext } from "../../shared-context";
import { identifier } from "..";

/**
 * Generate a create method. This will generate another autocrud
 * module and add it to the database.
 *
 * This will accept and entire record of parameters, and return
 * the primary key. This takes two queries!
 */
export default async (
  rootContext: InternalContext,
  database: DatabaseInternalWithModules,
  autocrudModule: AutocrudModule
): Promise<InternalContext> => {
  // create
  const restPath = `${autocrudModule.restPath}/create`;
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
      const queries = await database.createSQL(createModule);
      // make the row -- nothing to read here
      await database.execute(queries.create, context.parameters);
      // and the keys come back -- no parameters needed
      const readBackKeys = await database.execute(queries.readback);
      context.results = readBackKeys;
      return context;
    },
  };
  return rootContext;
};
