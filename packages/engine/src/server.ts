import { InternalContext } from "./context";
import Koa from "koa";
import bodyparser from "koa-bodyparser";
import OpenAPIBackend from "openapi-backend";
import YAML from "yaml";
import readFile from "read-file-utf8";
import path from "path";
import { HasContextualSQLModuleExecutors } from "./shared-context";
import { restructure } from "../../console/src/structured";

/**
 * Create a HTTP server exposing an OpenAPI style set of endpoints for each Database
 * and SQLModule.
 *
 * This does not actually start the server, it just hands you an instance that you
 * can start listening to later.
 *
 * @param rootContext - root server context with configuration
 * @param executionMap - context name to execution function mapping to actually 'run' a query
 */
export const createServer = async (
  rootContext: InternalContext & HasContextualSQLModuleExecutors
): Promise<Koa<Koa.DefaultState, Koa.DefaultContext>> => {
  const server = new Koa();

  // generated configuration is loaded up
  // TODO: the configuration is left on disk for current debugging -- but probably should be hidden
  const definition = YAML.parse(
    await readFile(
      path.join(rootContext.configuration.embraceSQLRoot, "openapi.yaml")
    )
  );

  // the handlers that wrap modules -- for GET and POST
  const handlers = {};

  // go ahead and make a handler for both GET and POST
  Object.keys(rootContext.contextualSQLModuleExecutors).forEach(
    (contextName) => {
      if (rootContext.readOnlyContextualSQLModuleExecutors[contextName]) {
        handlers[`get__${contextName}`] = async (
          _openAPI,
          httpContext
        ): Promise<void> => {
          try {
            // parameters from the query
            const context = {
              parameters: httpContext.request.query,
              results: [],
            };
            await rootContext.contextualSQLModuleExecutors[contextName](
              context
            );
            httpContext.body = context.results;
            httpContext.status = 200;
          } catch (e) {
            // this is the very far edge of the system, time for a log
            if (rootContext.configuration.logLevels.includes("error"))
              console.error(e);
            // send the full error to the client
            httpContext.status = 500;
            httpContext.body = restructure("error", e);
          }
        };
      }
      handlers[`post__${contextName}`] = async (
        _openAPI,
        httpContext
      ): Promise<void> => {
        try {
          // parameters from the body
          const context = {
            parameters: httpContext.request.body,
            results: [],
          };
          await rootContext.contextualSQLModuleExecutors[contextName](context);
          httpContext.body = context.results;
          httpContext.status = 200;
        } catch (e) {
          if (rootContext.configuration.logLevels.includes("error"))
            console.error(e);
          httpContext.status = 500;
          httpContext.body = restructure("error", e);
        }
      };
    }
  );

  // merge up all the handlers just created with the OpenAPI definition
  // and we are ready to go -- this counts on OpenAPI doing some validation
  // before our handlers get called
  const api = new OpenAPIBackend({
    definition,
    handlers,
  });
  api.init();

  // use as koa middleware
  server.use(bodyparser());
  server.use((ctx) => api.handleRequest(ctx.request, ctx));

  // looks like we can get away without any code generation, and just building a
  // map of operation id based handlers
  // https://github.com/anttiviljami/openapi-backend/blob/master/examples/koa/index.js
  return server;
};
