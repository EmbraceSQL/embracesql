import { Command } from "commander";
import {
  loadConfiguration,
  createServer,
  watchRoot,
  buildInternalContext,
  InternalContext,
} from "@embracesql/engine";
import { Server } from "http";
import expandHomeDir from "expand-home-dir";
import path from "path";

/**
 * Initialization action.
 */
export default new Command()
  .command("start [EMBRACEQL_ROOT] [PORT]")
  .description("Start up EmbraceSQL. ")

  .action(
    async (EMBRACEQL_ROOT: string, PORT: string): Promise<void> => {
      // fully qualified path from here on down will make things a lot simpler
      const root = path.resolve(
        expandHomeDir(
          EMBRACEQL_ROOT || process.env.EMBRACEQL_ROOT || "/var/embracesql"
        )
      );
      const port = parseInt(PORT || process.env.PORT || "8765");
      const configuration = await loadConfiguration(root);

      const listen = async (rootContext: InternalContext): Promise<Server> => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { decorateInternalContext } = require(path.join(root, "context"));
        const server = await createServer(decorateInternalContext(rootContext));
        console.info("Listening", {
          EMBRACE_SQL_ROOT: configuration.embraceSQLRoot,
          PORT: port,
        });
        return server.listen(port);
      };
      let internalContext = await buildInternalContext(configuration);
      let listener = await listen(internalContext);
      const watcher = watchRoot(root);
      watcher.emitter.on("reload", async (newContext: InternalContext) => {
        console.info("Reloading");
        listener.close(async () => {
          await internalContext.close();
          listener = await listen(newContext);
          internalContext = newContext;
        });
      });
    }
  );
