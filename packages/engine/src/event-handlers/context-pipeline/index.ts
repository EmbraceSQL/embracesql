import { InternalContext } from "../../context";
import generateCombined from "./generate-combined";
import generatePackage from "./generate-package";
import generateMigrations from "./generate-migrations";
import bindExecutors from "./bind-executors";

/**
 * After each SQLModule is run through a pipeline, combine the results for an
 * overall context. This will stitch together generated code into a contett containing
 * all the databases and SQL in a given system.
 */
export default async (
  rootContext: InternalContext
): Promise<InternalContext> => {
  await bindExecutors(rootContext);
  await generateCombined(rootContext);
  await generatePackage(rootContext);
  await generateMigrations(rootContext);
  return rootContext;
};
