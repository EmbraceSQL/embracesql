import { InternalContext, buildInternalContext } from "./context";
import { loadConfiguration } from "./configuration";

/**
 * Given a root directory, return an embedded context ready to be used with
 * and inprocess client.
 */
export const buildEmbeddedContext = async (
  root: string
): Promise<InternalContext> => {
  const configuration = await loadConfiguration(root);
  return buildInternalContext(configuration);
};
