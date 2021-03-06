import { EventEmitter } from "events";
import { loadConfiguration } from "./configuration";
import { buildInternalContext, InternalContext } from "./internal-context";
import chokidar from "chokidar";
import path from "path";

/**
 * Need to be able to close this off to exit cleanly
 * in unit testing.
 */
export type CloseableEventEmitter = {
  emitter: EventEmitter;
  close: () => Promise<void>;
};
/**
 * Create a whole new context..
 */
export const reload = async (
  embraceSQLRoot: string
): Promise<InternalContext> => {
  const configuration = await loadConfiguration(embraceSQLRoot);
  const newRootContext = await buildInternalContext(configuration);
  return newRootContext;
};

/**
 * Keep and eye on a root directory and rebuild it when files change.
 *
 * Note -- no need to worry about race conditions `buildRootContext` has
 * a throttle inside.
 */
export const watchRoot = (
  internalContext: InternalContext
): CloseableEventEmitter => {
  let oldInternalContext = internalContext;
  const emitter = new EventEmitter();

  // watch the whole directory
  const watcher = chokidar.watch(
    [path.resolve(`${internalContext.configuration.embraceSQLRoot}/**/*.sql`)],
    {
      ignoreInitial: true,
    }
  );

  // this is super convenient to not drown in a pile of single file changes
  watcher.on("all", async (event, path) => {
    const newInternalContext = await reload(
      internalContext.configuration.embraceSQLRoot
    );
    emitter.emit("reload", oldInternalContext, newInternalContext, {
      event,
      path,
    });
    oldInternalContext = newInternalContext;
  });
  return {
    emitter,
    close: (): Promise<void> => watcher.close(),
  };
};
