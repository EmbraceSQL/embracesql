import { InternalContext } from "../../internal-context";
import generateCombined from "./generate-combined";
import generateMigrations from "./generate-migrations";
import transformAuthorizations from "./transform-authorizations";

/**
 * After each SQLModule is run through a pipeline, combine the results for an
 * overall context. This will stitch together generated code into a contett containing
 * all the databases and SQL in a given system.
 */
export default async (
  rootContext: InternalContext
): Promise<InternalContext> => {
  await generateCombined(rootContext);
  await generateMigrations(rootContext);
  await transformAuthorizations(rootContext);
  return rootContext;
};
