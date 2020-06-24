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
  const module = (database.modules[restPath] = {
    ...autocrudModule,
    contextName: identifier(`${database.name}/${restPath}`),
    restPath,
    namedParameters: autocrudModule.keys,
    resultsetMetadata: autocrudModule.columns,
    canModifyData: false,
  });
  const keyWhere = module.namedParameters
    .map((k) => `${k.name} = :${k.name}`)
    .join(" AND ");
  const allRows = `SELECT * FROM ${autocrudModule.name};`;
  const byKey = `SELECT * FROM ${autocrudModule.name} WHERE ${keyWhere};`;
  rootContext.moduleExecutors[module.contextName] = {
    database,
    module,
    executor: async (context: Context): Promise<Context> => {
      const doOne = async (parameters: SQLParameterSet): Promise<SQLRow[]> => {
        return database.execute(byKey, parameters);
      };
      if (context.parameters.length) {
        // lots of ways to implement this, let's do the naive one for the moment
        const resultSets = context.parameters.map(doOne);
        // flatten out a bit so this looks like a result set
        context.results = (await Promise.all(resultSets)).flat(2);
      } else {
        // without parameters, just run a query to get all rows
        context.results = await database.execute(allRows);
      }
      return context;
    },
  };
  return rootContext;
};
