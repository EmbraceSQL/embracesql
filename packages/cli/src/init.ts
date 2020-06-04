import { Command } from "commander";
import { generateFromTemplates } from "@embracesql/engine";
/**
 * Initialization action.
 */
export default new Command()
  .command("init")
  .description("Generates a docker-compose.yaml so you can get started.")
  .action(async () => {
    await generateFromTemplates(undefined, "cli", true);
    return;
  });
