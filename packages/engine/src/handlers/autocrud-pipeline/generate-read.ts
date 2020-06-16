import { InternalContext, DatabaseInternalWithModules } from "../../context";
import {
  AutocrudModule,
  Context,
  isSQLParameterSetBatch,
  isSQLParameterSet,
  SQLParameterSet,
  SQLRow,
} from "../../shared-context";
import { identifier } from "..";

/**
 * Generate a read method. This will generate another autocrud
 * module and add it to the database.
 *
 * This is a variadic function.
 * When no args / no parameters -> read it all.
 * When just the key -> read one.
 */
export default async (
  rootContext: InternalContext,
  database: DatabaseInternalWithModules,
  autocrudModule: AutocrudModule
): Promise<InternalContext> => {
  const restPath = `${autocrudModule.restPath}/read`;
  const readModule = (database.autocrudModules[restPath] = {
    ...autocrudModule,
    contextName: identifier(`${database.name}/${restPath}`),
    restPath,
    namedParameters: autocrudModule.keys,
    resultsetMetadata: autocrudModule.columns,
    canModifyData: false,
  });
  const queries = await database.readSQL(readModule);
  rootContext.autocrudModuleExecutors[readModule.contextName] = {
    autocrudModule: readModule,
    executor: async (context: Context): Promise<Context> => {
      const doOne = async (parameters: SQLParameterSet): Promise<SQLRow[]> => {
        return database.execute(queries.byKey, parameters);
      };
      if (isSQLParameterSetBatch(context.parameters)) {
        // lots of ways to implement this, let's do the naive one for the moment
        const resultSets = (context.parameters as SQLParameterSet[]).map(doOne);
        // flatten out a bit so this looks like a result set
        context.results = (await Promise.all(resultSets)).flat(2);
      } else if (isSQLParameterSet(context.parameters)) {
        // this is a pretty simple case -- just run and return
        context.results = await doOne(context.parameters);
      } else {
        // without parameters, just run a query to get all rows
        context.results = await database.execute(queries.allRows);
      }
      return context;
    },
  };
  return rootContext;
};
