import Koa from "koa";
import bodyparser from "koa-bodyparser";
import OpenAPIBackend from "openapi-backend";
import YAML from "yaml";
import path from "path";
import {
  HasConfiguration,
  HasEntryPoints,
  SQLParameterSet,
} from "./shared-context";
import { restructure } from "../../console/src/structured";
import fs from "fs-extra";

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
  rootContext: HasConfiguration & HasEntryPoints
): Promise<Koa<Koa.DefaultState, Koa.DefaultContext>> => {
  const server = new Koa();

  // generated configuration is loaded up
  const definition = YAML.parse(
    await fs.readFile(
      path.join(rootContext.configuration.embraceSQLRoot, "openapi.yaml"),
      "utf8"
    )
  );

  // the handlers that wrap modules -- for GET and POST
  const handlers = {};

  // go ahead and make a handler for both GET and POST
  Object.keys(rootContext.entryPoints).forEach((contextName) => {
    if (!rootContext.entryPoints[contextName].module.canModifyData) {
      handlers[`get__${contextName}`] = async (
        _openAPI,
        httpContext
      ): Promise<void> => {
        try {
          // parameters from the query
          const parameters = [httpContext.request.query];
          httpContext.body = await rootContext.entryPoints[
            contextName
          ].executor((parameters as unknown) as SQLParameterSet);
          httpContext.status = 200;
        } catch (e) {
          // this is the very far edge of the system, time for a log
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
        const parameters = Array.isArray(httpContext.request.body)
          ? httpContext.request.body
          : [httpContext.request.body];
        httpContext.body = await rootContext.entryPoints[contextName].executor(
          (parameters as unknown) as SQLParameterSet
        );
        httpContext.status = 200;
      } catch (e) {
        console.error(e);
        httpContext.status = 500;
        httpContext.body = restructure("error", e);
      }
    };
  });

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
