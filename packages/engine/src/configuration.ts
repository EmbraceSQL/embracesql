import { cosmiconfig } from "cosmiconfig";
import Url from "url-parse";
import { generateFromTemplates } from "./generator";
import { LogLevel } from "../../console/src/structured";
import path from "path";

/**
 * Named URLs to databases.
 */
type Databases = {
  [index: string]: Url;
};

/**
 * The all important root configuration. This tells EmbraceSQL which databases to manage.
 */
export type Configuration = {
  /**
   * The root directory used to start this config.
   */
  embraceSQLRoot: string;
  /**
   * URL identifying Kafka topic or REST endpoing to post commands.
   */
  twinCommandsTo?: string;
  /**
   * All available databases.
   */
  databases?: Databases;
  /**
   * Logging control
   */
  logLevels: LogLevel[];
  /**
   * Flag for embedded mode. This will be force set by the embedded cli.
   */
  embedded: boolean;
  /**
   * Optional name used in bootsrap code generation.
   */
  name?: string;
};

/**
 * Load up a configuration object.
 *
 * This will interpolate environment variables, build and object and hand it back.
 *
 * Will look in the current directory or a environment variable set root.
 */
export const loadConfiguration = async (
  root: string,
  embedded = false
): Promise<Configuration> => {
  // default name based on the path
  const name = root.split(path.sep).slice().pop() || "default";
  // run the root generation templates, gives you something to work
  // with even if you start in an empty directory so that system 'always works'
  await generateFromTemplates(
    {
      configuration: {
        name,
        embedded,
        embraceSQLRoot: root,
        logLevels: ["info", "error"],
      },
      databases: undefined,
      directQueryExecutors: {},
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
  // pop in some types so we are working with actual URLs
  const databases = Object.fromEntries(
    Object.keys(result.config.databases).map((databaseName) => [
      databaseName,
      new Url(result.config.databases[databaseName]),
    ])
  );
  return {
    ...config,
    logLevels: ["error"] || result.config.logLevels,
    databases,
  };
};
