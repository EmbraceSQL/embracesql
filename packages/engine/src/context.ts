import { embraceDatabases } from "./database-engines";
import { embraceEventHandlers } from "./handlers";
import {
  Database,
  SQLModule,
  SQLColumnMetadata,
  SQLParameters,
  SQLRow,
  HasConfiguration,
  Configuration,
  SQLTableMetadata,
  AutocrudModule,
  SQLModuleExecutor,
  AutocrudExecutor,
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
export type SQLModules = {
  [index: string]: SQLModule;
};

/**
 * All available autocrud modules.
 * This is in a compressed path format, so each key can have / in it.
 */
export type AutocrudModules = {
  [index: string]: AutocrudModule;
};

/**
 * SQL Pair for C in CRUD.
 */
export type CreateAndReadbackSQL = {
  create: string;
  readback: string;
};

/**
 * SQL for the R in CRUD.
 */
export type ReadSQL = {
  allRows: string;
  byKey: string;
};

/**
 * A single instance of a database for use internally.
 */
export type DatabaseInternal = Database & {
  /**
   * Execute the sql module query on this database, and
   * promise some result.
   *
   * @param sql - sql string in the dialect of the target database, can include :name style paramters
   * @param parameters - name value pairs are the passed parameters
   */
  execute: (sql: string, parameters?: SQLParameters) => Promise<SQLRow[]>;
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
   * Get schematic information on all tables.
   */
  schema: () => Promise<SQLTableMetadata[]>;
  /**
   * Get the full create statement sql, with an immeidate readback
   */
  createSQL: (sqlTable: SQLTableMetadata) => Promise<CreateAndReadbackSQL>;
  /**
   * Get the SQL to read back a table.
   */
  readSQL: (sqlTable: SQLTableMetadata) => Promise<ReadSQL>;
};

/**
 * Collections of modules.
 */
export type HasModules = {
  /**
   * All modules for this database.
   */
  sqlModules: SQLModules;
  /**
   * Autocrud for this database.
   */
  autocrudModules: AutocrudModules;
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
 * The root context is the context of configuration, databases, and sql modules and is
 * used to drive code generation and runtime execution 'in the engine' of EmbraceSQL
 *
 * The type here is a bit different from the context used in handlers, it has more metadata!
 */
export type InternalContext = HasConfiguration & {
  /**
   * All configured databases, by name.
   */
  databases: AllDatabasesInternal;
  /**
   * Close all DB connections.
   */
  close: () => Promise<void>;
  /**
   * Ability to execute sql modules.
   */
  sqlModuleExecutors: {
    [index: string]: SQLModuleExecutor;
  };
  /**
   * Ability to execute autocrud modules.
   */
  autocrudModuleExecutors: {
    [index: string]: AutocrudExecutor;
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
    sqlModuleExecutors: {},
    autocrudModuleExecutors: {},
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
