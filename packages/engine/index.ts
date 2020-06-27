/**
 * Root module -- home base to collect and export.
 */

import { generateFromTemplates } from "./src/generator";
import { loadConfiguration } from "./src/configuration";
import { watchRoot } from "./src/watcher";
import { InternalContext, buildInternalContext } from "./src/internal-context";
import { migrate } from "./src/migrations";
import { createServer } from "./src/server";
import { withTransaction } from "./src/transactions";
import {
  SQLRow,
  SQLParameterSet,
  DatabaseTransactions,
  HasEntryPoints,
  HasConfiguration,
  Closeable,
  GenericContext,
  Context,
  Grant,
  GrantType,
  Message,
  Headers,
  HasHeaders,
  CanSetHeaders,
  SQLScalarType,
} from "./src/shared-context";
import { validateOpenIDAuthorization } from "./src/authorization";
import { polyArray } from "./src/polys";
import { nodePost } from "./src/transport";

// re-export symbols as needed
export {
  generateFromTemplates,
  loadConfiguration,
  watchRoot,
  InternalContext,
  buildInternalContext,
  migrate,
  createServer,
  withTransaction,
  SQLRow,
  SQLParameterSet,
  DatabaseTransactions,
  HasEntryPoints,
  HasConfiguration,
  Closeable,
  GenericContext,
  Context,
  Grant,
  GrantType,
  Message,
  Headers,
  HasHeaders,
  CanSetHeaders,
  validateOpenIDAuthorization,
  polyArray,
  SQLScalarType,
  nodePost,
};
