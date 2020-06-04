import { EventEmitter } from "events";
import { loadConfiguration } from "./configuration";
import { buildInternalContext, InternalContext } from "./context";
import chokidar from "chokidar";

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
export const reload = async (embraceSQLRoot): Promise<InternalContext> => {
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
export const watchRoot = (embraceSQLRoot: string): CloseableEventEmitter => {
  const emitter = new EventEmitter();

  // watch the whole directory
  const watcher = chokidar.watch([`${embraceSQLRoot}/**/*.sql`]);

  // this is super convenient to not drown in a pile of single file changes
  watcher.on("change", async () => {
    console.info("reload needed", embraceSQLRoot);
    const newRootContext = await reload(embraceSQLRoot);
    emitter.emit("reload", newRootContext);
  });
  return {
    emitter,
    close: (): Promise<void> => watcher.close(),
  };
};
