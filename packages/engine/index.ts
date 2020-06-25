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
  ValueOrArray,
  Headers,
  HasHeaders,
  CanSetHeaders,
} from "./src/shared-context";

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
  ValueOrArray,
  Headers,
  HasHeaders,
  CanSetHeaders,
};
