import { Command } from "commander";
import { createServer, watchRoot, InternalContext } from "@embracesql/engine";
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
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { EmbraceSQLEmbedded } = require(root);

      const listen = async (rootContext?: InternalContext): Promise<Server> => {
        const server = await createServer(
          await EmbraceSQLEmbedded(rootContext)
        );
        console.info("Listening", {
          EMBRACE_SQL_ROOT: root,
          PORT: port,
        });
        return server.listen(port);
      };
      // start up an initial embeded context and listen
      const initialContext = await EmbraceSQLEmbedded();
      let listener = await listen(initialContext);
      const watcher = watchRoot(initialContext);
      watcher.emitter.on(
        "reload",
        async (oldContext: InternalContext, newContext: InternalContext) => {
          console.info("Reloading");
          listener.close(async () => {
            await oldContext.close();
            listener = await listen(newContext);
          });
        }
      );
    }
  );
