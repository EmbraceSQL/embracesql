import { Configuration } from "./configuration";
import { embraceDatabases } from "./database-engines";
import { embraceEventHandlers } from "./event-handlers";
import {
  Database,
  SQLModule,
  SQLColumnMetadata,
  SQLParameters,
  SQLRow,
  SQLModuleDirectExecutors,
} from "./shared-context";
import { AST } from "node-sql-parser";
import { SQLModuleInternal } from "./event-handlers/sqlmodule-pipeline";

/**
 * Keep track of individual migration files with this type.
 */
export type MigrationFile = {
  name: string;
  content: string;
};

/**
 * This is the tree of paths derived from SQL files on disk. This is in
 * a compressed path format, so each key can have / in it.
 */
export type SQLModules = {
  [index: string]: SQLModule;
};

/**
 * A single instance of a database for use internally.
 */
export type DatabaseInternal = Database & {
  /**
   * All modules for this database.
   */
  SQLModules: SQLModules;
  /**
   * Execute the sql module query on this database, and
   * promise some result.
   *
   * @param SQLModule - execute this module, returning results
   * @param parameters - name value pairs are the passed parameters
   */
  execute: (
    sqlModule: SQLModule,
    parameters?: SQLParameters
  ) => Promise<SQLRow[]>;
  /**
   * Analyze the passed module and determine the resultset type(s).
   */
  analyze: (sqlModule: SQLModuleInternal) => Promise<SQLColumnMetadata[]>;
  /**
   * Parse out the SQL.
   */
  parse: (SQLModule) => AST[] | AST;
  /**
   * Do a migration.
   */
  migrate: (migrationFile: MigrationFile) => Promise<void>;
  /**
   * Clean close.
   */
  close: () => Promise<void>;
};

/**
 * All the databases from the internal point of view.
 */
export type AllDatabasesInternal = {
  [index: string]: DatabaseInternal;
};

/**
 * The root context is the context of configuration, databases, and sql modules and is
 * used to drive code generation and runtime execution 'in the engine' of EmbraceSQL
 *
 * The type here is a bit different from the context used in handlers, it has more metadata!
 */
export type InternalContext = SQLModuleDirectExecutors & {
  /**
   * The configuration used to build this context.
   */
  configuration: Configuration;
  /**
   * All configured databases, by name.
   */
  databases: AllDatabasesInternal;
  /**
   * Close all DB connections.
   */
  close: () => Promise<void>;
};

/**
 * With a configuration in hand, set up a new rootContext.
 *
 * This is built to be called -- repeatedly if needed. The idea is you can watch, and
 * rebuild a whole new context as needed -- swapping the root context at runtime to
 * hot-reconfigure the system without worrying about any state leaking.
 *
 * @param configuration - build a root context from this configuration.
 */
export const buildInternalContext = async (
  configuration: Configuration
): Promise<InternalContext> => {
  const databases = await embraceDatabases(configuration);
  const internalContext = {
    configuration,
    databases,
    directQueryExecutors: {},
    close: async (): Promise<void> => {
      const waitForThem = Object.values(databases).map((database) =>
        database.close()
      );
      await Promise.all(waitForThem);
    },
  };
  // need the database first, their connections are used
  // to mine metadata
  await embraceDatabases(configuration);
  await embraceEventHandlers(internalContext);
  return internalContext;
};
