import {
  buildInternalContext,
  loadConfiguration,
  InternalContext,
} from "@embracesql/engine";
import * as types from "./context";

type EmbeddedEngine = types.HasContextualSQLModuleExecutors &
  types.SQLModuleTree;

/**
 * This is in effect -- EmbraceSQL, the fully configured and ready to
 * run in process engine. It can be used directly in process, or wrapped
 * in a server.
 */
export const EmbraceSQLEmbedded = async (
  rootContext?: InternalContext
): Promise<EmbeddedEngine> => {
  // the package itself has the configuration and is the root
  const context = rootContext
    ? rootContext
    : await buildInternalContext(await loadConfiguration(__dirname));
  // at this point the context has the .directQueryExecutors and
  // can run a query to the database, but doesn't have handlers yet
  const handlerWrappedExecutors = types.SQLModuleExecutorsWithHandlers(context);
  // here is where things get tricky -- the context can have a database map too
  // but it isn't built yet -- time for some ... self referential code -- we're
  // making the databases and using the databases in the functions too
  const databases = {
    default: {
      hello: {
        sql: async (
          parameters: types.default_helloParameters
        ): Promise<types.default_helloRow[]> => {
          return (
            await handlerWrappedExecutors.default_hello({
              parameters,
              results: [],
              databases,
            })
          ).results;
        },
      },
    },
  };
  // and contextual named handlers -- these are used by http server wrappers
  const contextualSQLModuleExecutors = {
    // database default
    default_hello: async (
      context: types.default_helloContext
    ): Promise<types.default_helloContext> => {
      context.databases = databases;
      return handlerWrappedExecutors.default_hello(context);
    },
  };
  // map of our read only methods
  const readOnlyContextualSQLModuleExecutors = {
    // database default
    default_hello: async (
      context: types.default_helloContext
    ): Promise<types.default_helloContext> => {
      context.databases = databases;
      return handlerWrappedExecutors.default_hello(context);
    },
  };
  return {
    ...context,
    databases,
    contextualSQLModuleExecutors,
    readOnlyContextualSQLModuleExecutors,
  };
};
