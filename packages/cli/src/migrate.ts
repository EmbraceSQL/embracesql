import { Command } from "commander";
import {
  loadConfiguration,
  buildInternalContext,
  migrate,
} from "@embracesql/engine";
import expandHomeDir from "expand-home-dir";
import path from "path";

/**
 * Initialization action.
 */
export default new Command()
  .command("migrate [EMBRACEQL_ROOT]")
  .description("Run database migrations.")

  .action(
    async (EMBRACEQL_ROOT: string): Promise<void> => {
      // fully qualified path from here on down will make things a lot simpler
      const root = path.resolve(
        expandHomeDir(
          EMBRACEQL_ROOT || process.env.EMBRACEQL_ROOT || "/var/embracesql"
        )
      );
      console.info("beginning migration", path.relative(process.cwd(), root));
      const configuration = await loadConfiguration(root);
      const initialContext = await buildInternalContext(configuration);
      await migrate(initialContext);
    }
  );
