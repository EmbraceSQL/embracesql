import { Command } from "commander";
import {
  loadConfiguration,
  buildInternalContext,
  watchRoot,
  InternalContext,
} from "@embracesql/engine";
import expandHomeDir from "expand-home-dir";
import path from "path";
import ncc from "@zeit/ncc";
import fs from "fs-extra";

/**
 * Command line option type for the typescript!
 */
type options = {
  nowatch: boolean;
};

/**
 * Bundle/compile embraceSQL itself into a single emebdded module.
 *
 * This doesn't bundle the handlers or generated code, but the core engine.
 * The idea here is to have no opportunity to have a version mismatch of
 * EmbraceSQL itself -- the CLI you use to generate is the CLI used to create
 * the runtime. Its - sorta like pulling itsef up by it's sql-y bootstraps
 */
export const bundleEmbedded = async (
  EMBRACESQL_ROOT: string
): Promise<void> => {
  try {
    const sourceFile = path.join(__dirname, "..", "embedded.ts");
    const { code, assets } = await ncc(sourceFile, {
      // provide a custom cache path or disable caching
      cache: path.resolve(path.join(EMBRACESQL_ROOT, ".cache")),
      // externals to leave as requires of the build
      externals: [],
      // directory outside of which never to emit assets
      filterAssetBase: EMBRACESQL_ROOT,
      minify: false,
      sourceMap: true,
      sourceMapBasePrefix: EMBRACESQL_ROOT,
      sourceMapRegister: true,
      watch: false,
      v8cache: false,
      quiet: false,
      debugLog: false,
    });
    await fs.outputFile(path.join(EMBRACESQL_ROOT, "index.js"), code);
    // type definitions are found in the assets
    const waitForAssets = Object.keys(assets).map((assetFileName) => {
      if (assetFileName.endsWith("embedded.d.ts")) {
        const assetContent = (assets[assetFileName].source as Buffer).toString(
          "utf-8"
        );
        return fs.outputFile(
          path.join(EMBRACESQL_ROOT, "embedded.d.ts"),
          assetContent
        );
      }
    });
    await Promise.all(waitForAssets);
  } catch (e) {
    console.error(e);
  } finally {
  }
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
      watcher.emitter.on("reload", async (newContext: InternalContext) => {
        console.info("Reloading");
        // just needed for generation -- so close it off.
        await newContext.close();
      });
    }
  );
