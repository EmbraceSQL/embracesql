import { Command } from "commander";
import {
  loadConfiguration,
  buildInternalContext,
  watchRoot,
  InternalContext,
} from "@embracesql/engine";
import expandHomeDir from "expand-home-dir";
import path from "path";

/**
 * Command line option type for the typescript!
 */
type options = {
  nowatch: boolean;
};

/**
 * Initialization action.
 */
export default new Command()
  .command("embedded [EMBRACEQL_ROOT]")
  .option("-n, --nowatch", "Disable watching for changes")
  .description("Generate an embebbed version of EmbraceSQL.")

  .action(
    async (EMBRACEQL_ROOT: string, cmd: options): Promise<void> => {
      // fully qualified path from here on down will make things a lot simpler
      const root = path.resolve(
        expandHomeDir(
          EMBRACEQL_ROOT || process.env.EMBRACEQL_ROOT || "/var/embracesql"
        )
      );
      const configuration = await loadConfiguration(root, true);
      const internalContext = await buildInternalContext(configuration);
      // just needed for generation -- so close it off.
      internalContext.close();
      // no watch -- bail
      if (cmd.nowatch) return;

      const watcher = watchRoot(internalContext);
      watcher.emitter.on(
        "reload",
        async (_oldContext: InternalContext, newContext: InternalContext) => {
          console.info("Reloading");
          // just needed for generation -- so close it off.
          await newContext.close();
        }
      );
    }
  );
