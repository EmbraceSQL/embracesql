/**
 * Root module -- home base to collect and export.
 */

import { buildEmbeddedContext } from "./src/embedded";
import { generateFromTemplates } from "./src/generator";
import { loadConfiguration } from "./src/configuration";
import { watchRoot } from "./src/watcher";
import { InternalContext, buildInternalContext } from "./src/context";
import { migrate } from "./src/migrations";

// re-export symbols as needed
export {
  buildEmbeddedContext,
  generateFromTemplates,
  loadConfiguration,
  watchRoot,
  InternalContext,
  buildInternalContext,
  migrate,
};
