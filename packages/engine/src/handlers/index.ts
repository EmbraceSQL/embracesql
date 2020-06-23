import { InternalContext } from "../internal-context";
import sqlModulePipeline from "./sqlmodule-pipeline";
import contextPipeline from "./context-pipeline";
import autoCrudPipeline from "./autocrud-pipeline";
import generateDefaultHandlers from "./generate-default-handlers";

/**
 * Scrub up identifiers to be valid JavaScript names.
 */
export const identifier = (key: string): string => {
  const id = key
    .trim()
    // quotes won't do
    .replace(/['"]+/g, "")
    // snake case
    .replace(/\W+/g, "_");
  return /^\d/.test(id) ? "_" + id : id;
};

/**
 * Manage a directory of event handlers, which form the basis of APIs
 *
 * All SQL files in the directory serve as entry points. The process is to enumerate
 * all of these SQL files and build an in memory file system analog with hashes
 * to be used as cache keys.
 *
 * * Loads up and hashes all sql files found
 * * Creates a database specific wrapper for invoking each SQL.
 * * Makes sure all the needed event handlers are generated
 *
 * @param rootContext - like other internal methods, run off the root context
 */
export const embraceEventHandlers = async (
  rootContext: InternalContext
): Promise<InternalContext> => {
  // all the on disk sql modules and their handlers
  await sqlModulePipeline(rootContext);
  // auto auto CRUD ... I wannt be ... an Auto CRUD
  await autoCrudPipeline(rootContext);
  // every module is now generated -- time for handler generation
  for (const database of Object.values(rootContext.databases)) {
    for (const module of Object.values(database.modules)) {
      await generateDefaultHandlers(rootContext, module);
    }
  }
  // stitch together the full context and final combined files
  // this is the 'pack' phase
  await contextPipeline(rootContext);
  return rootContext;
};
