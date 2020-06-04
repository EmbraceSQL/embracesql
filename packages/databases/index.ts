import { buildEmbeddedContext } from "embracesql";
import { EmbraceSQL } from "./client/node-inprocess";

/**
 * Use this to access the database.
 */
export const EmbraceSQLEmbedded = async () => {
  // the package itself has the configuration and is the root
  const context = await buildEmbeddedContext(__dirname);
  return EmbraceSQL(context);
};
