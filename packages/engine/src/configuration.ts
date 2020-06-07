import { cosmiconfig } from "cosmiconfig";
import { generateFromTemplates } from "./generator";
import path from "path";
import { Configuration } from "./shared-context";

/**
 * Load up a configuration object.
 *
 * This will interpolate environment variables, build and object and hand it back.
 *
 * Will look in the current directory or a environment variable set root.
 */
export const loadConfiguration = async (
  root: string
): Promise<Configuration> => {
  // default name based on the path
  const name = root.split(path.sep).slice().pop() || "default";
  // run the root generation templates, gives you something to work
  // with even if you start in an empty directory so that system 'always works'
  await generateFromTemplates(
    {
      configuration: {
        name,
        embraceSQLRoot: root,
      },
      databases: undefined,
      directQueryExecutors: {},
      autocrudExecutors: {},
      close: (): Promise<void> => {
        return;
      },
    },
    "default"
  );
  // TODO env var substition loader hook
  // going with cosmic config -- even though this is just doing YAML for the moment
  const explorer = cosmiconfig("embracesql", {
    searchPlaces: ["embracesql.yaml", "embracesql.yml"],
  });
  const result = await explorer.search(root);
  const config = result.config as Configuration;
  config.embraceSQLRoot = root;
  return {
    ...config,
  };
};
