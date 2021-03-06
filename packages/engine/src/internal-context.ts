import { embraceDatabases } from "./database-engines";
import { embraceEventHandlers } from "./handlers";
import {
  Database,
  SQLModule,
  SQLColumnMetadata,
  SQLRow,
  HasConfiguration,
  Configuration,
  AutocrudModule,
  Closeable,
  Context,
  SQLParameterSet,
  CommonDatabaseModule,
  ContextualExecutor,
  ParameterizedSQL,
} from "./shared-context";
import { AST } from "node-sql-parser";
import { SQLModuleInternal } from "./handlers/sqlmodule-pipeline";

/**
 * Keep track of individual migration files with this type.
 */
export type MigrationFile = {
  name: string;
  content: string;
};

/**
 * This is the tree of paths derived from SQL files on disk.
 * This is in a compressed path format, so each key can have / in it.
 */
export type Modules = {
  [index: string]: SQLModule | AutocrudModule;
};

/**
 * Function wrapper for atomicicity in running in the database.
 */
export interface AtomicDatabaseAction {
  /**
	@param fn - Promise-returning/async function.
	@returns The promise returned by calling `fn(...arguments)`.
	*/
  <ReturnType>(fn: () => PromiseLike<ReturnType> | ReturnType): Promise<
    ReturnType
  >;
}

/**
 * A single instance of a database for use internally.
 */
export type DatabaseInternal = Database & {
  /**
   * Execute the sql module query on this database, and
   * promise some result.
   *
   * @param parameters - name value pairs are the passed parameters to use
   */
  execute: (
    sqlModule: ParameterizedSQL,
    parameters?: SQLParameterSet
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
  /**
   * Read back query of an inserted row is always proprietary. Generate that SQL.
   */
  readLastKeySQL: (autocrudModule: AutocrudModule) => Promise<string>;
  /**
   * Throttle access to a database for atomicity. This is needed when thre
   * are multiple parallel queries possible and you need to batch -- such
   * as reading back a created key in the face of parallel inserts.
   */
  atomic: AtomicDatabaseAction;
};

/**
 * Collections of modules.
 */
export type HasModules = {
  /**
   * All modules for this database.
   */
  modules: Modules;
};

/**
 * Fully wrapped internal database representation.
 */
export type DatabaseInternalWithModules = DatabaseInternal & HasModules;

/**
 * All the databases from the internal point of view.
 */
export type AllDatabasesInternal = {
  [index: string]: DatabaseInternalWithModules;
};

/**
 * Module, paired up with an actual execution functtion that works on a context.
 */
export type ContextualExecutableModule = {
  readonly database: DatabaseInternal;
  readonly module: CommonDatabaseModule;
  executor: ContextualExecutor<Context>;
};

/**
 * The root context is the context of configuration, databases, and sql modules and is
 * used to drive code generation and runtime execution 'in the engine' of EmbraceSQL
 *
 * The type here is a bit different from the context used in handlers, it has more metadata!
 */
export type InternalContext = HasConfiguration &
  Closeable & {
    /**
     * All configured databases, by name.
     */
    databases: AllDatabasesInternal;
    /**
     * Ability to execute sql modules.
     */
    moduleExecutors: {
      [index: string]: ContextualExecutableModule;
    };
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
    moduleExecutors: {},
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
