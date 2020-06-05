/**
 * Root module -- home base to collect and export.
 */

import { generateFromTemplates } from "./src/generator";
import { loadConfiguration } from "./src/configuration";
import { watchRoot } from "./src/watcher";
import { InternalContext, buildInternalContext } from "./src/context";
import { migrate } from "./src/migrations";
import { createServer } from "./src/server";

// re-export symbols as needed
export {
  generateFromTemplates,
  loadConfiguration,
  watchRoot,
  InternalContext,
  buildInternalContext,
  migrate,
  createServer,
};
