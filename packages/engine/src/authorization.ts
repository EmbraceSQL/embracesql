import { HasHeaders, HasToken, HasConfiguration } from "./shared-context";
import { parseBearerToken, FileCache, validate } from "@embracesql/identity";
import path from "path";

/**
 * Built in macro to validate OpenID tokens.
 */
export const validateOpenIDAuthorization = async (
  context: HasHeaders & HasToken & HasConfiguration
): Promise<void> => {
  // we will eat errors, validation isn't mandatory.
  try {
    context.token = await validate(parseBearerToken(context.headers), {
      cache: FileCache(
        path.resolve(context.configuration.embraceSQLRoot, ".embracesql", "jwk")
      ),
      ignoreExp: context.configuration.ignoreExp,
    });
    return;
  } catch (e) {
    console.assert(e);
    //TODO -- error event
  }
};
