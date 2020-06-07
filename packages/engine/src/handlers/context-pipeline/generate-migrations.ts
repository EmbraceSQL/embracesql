import { InternalContext } from "../../context";
import path from "path";
import fs from "fs-extra";

/**
 * Stitch together all the individual SQLModules into final templates.
 *
 * @rootContext - as usual, our root context
 */
export default async (
  rootContext: InternalContext
): Promise<InternalContext> => {
  for (const databaseName of Object.keys(rootContext.databases)) {
    await fs.ensureDir(
      path.join(
        rootContext.configuration.embraceSQLRoot,
        "migrations",
        databaseName
      )
    );
  }
  return rootContext;
};
