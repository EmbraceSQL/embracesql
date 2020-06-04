/**
 * This containes context types shared between the EmbraceSQL server
 * and any generated code used by clients.
 *
 * This file is included whole in generated code, keeping it as a stand
 * alone code file like this is to allow highlighting and completion -- making
 * a huge about of code in handlebars is not fun in the editor, so the idea
 * here is to have a few base types, and derive a tiny bit in handlebars.
 *
 * Even though this isn't really a handlebars template, it is registered
 * as a partial, so resist the urge to use mustaches in here.
 */

/**
 * A message, passed for security and logging.
 */
export type Message = string | object;

/**
 * Security types.
 */
export type GrantType = "allow" | "deny";

/**
 * A single grant, stored away in the context.
 */
export type Grant = {
  /**
   * This type is set automatically for you.
   */
  type: GrantType;
  /**
   * Your additional message, which can be an object allowing you
   * to use it as a metadata store with security context informmation.
   */
  message: Message;
};

/**
 * Types mapped back into API calls from SQL.
 */
export type SQLType = string | number | boolean | null;

/**
 * Peer string naming used for generation.
 */
export type SQLTypeName = "string" | "number" | "boolean" | "null";

/**
 * Named parameters. This is a name/value pair hash constrained
 * to our available SQL Types.
 *
 * This base type is elastic and can have any name value pairs
 */
export type SQLParameter = {
  /**
   * Set your values by name.
   */
  name: string;
  /**
   * And a value.
   */
  value?: SQLType;
};

/**
 * One result set column metadata.
 */
export type SQLColumnMetadata = {
  /**
   * Use this name to access the row. These are valid JavaScript variable names.
   */
  readonly name: string;

  /**
   * Type identifier.
   */
  readonly type: SQLTypeName;
};

/**
 * Each SQL found on disk has some data -- the SQL itself, and will
 * get additional metadata attached to it.
 */
export type SQLModule = {
  /**
   * Relative path useful for REST.
   */
  readonly restPath: string;
  /**
   * Fully qualified file name on disk.
   */
  readonly fullPath: string;
  /**
   * Chain of relative to EmbraceSQLRoot folder paths, shallow to deep,
   * that is used to build up handler chains.
   */
  readonly beforeHandlerPaths: string[];
  /**
   * Chain of relative to EmbraceSQLRoot folder paths, deep to shallow,
   * that is used to build up handler chains.
   */
  readonly afterHandlerPaths: string[];
  /**
   * Actual SQL text source, unmodified, read from disk
   */
  readonly sql: string;
  /**
   * Content based cache key to use for any hash lookups, so that content
   * changes to the SQL equal cache misses.
   */
  readonly cacheKey: string;
  /**
   * Module safe name for the context.
   */
  readonly contextName: string;
  /**
   * All the parameters we found by looking at the query. These are in an array
   * to facilitate conversion of named to positional parameters.
   */
  namedParameters?: SQLParameter[];
  /**
   * Result set metadata, which may be an array because of semicolon batches.
   */
  resultsetMetadata?: SQLColumnMetadata[];
  /**
   * When true, this module may modify data.
   */
  canModifyData?: boolean;
};

/**
 * Transaction control for databases, exposed as asynchronous methods.
 *
 * Per database implementations of these methods will issue the appropriate
 * SQL or API calls to the underlying database and deal with issues such
 * as nested transactions.
 */
export type DatabaseTransactions = {
  /**
   * Start up a new transaction, or if in a transaction, a nested
   * transaction.
   */
  begin: () => Promise<void>;

  /**
   * Commit the in process transaction. Database state changes are saved.
   */
  commit: () => Promise<void>;

  /**
   * Roll back the in process transaction, such that any database
   * state changes are no saved.
   */
  rollback: () => Promise<void>;
};

/***
 * A single database available via the context
 */
export type Database = {
  /**
   * Every database has a name derived from the config file. This
   * is used as its map key.
   */
  readonly name: string;
  /**
   * Access transaction control of the database here.
   */
  readonly transactions: DatabaseTransactions;
};

/**
 * This context is the 'one true parameter' passed to every Embrace SQL
 * event handler. It is created by EmbraceSQL at the start of each API
 * request, and serves as a shared state allowing handlers broad access
 * to the results of other handlers and databases managed by EmbraceSQL.
 *
 * Having a single context parameter simplifies call signatures and facilitates
 * auto-complete in your editing experience.
 *
 * This context is the base type. EmbraceSQL will generate an extended context
 * representing your specific set of configured databases. Properties of the context
 * that will be generated will be noted in comments.
 *
 */
export type Context<RowType> = {
  /**
   * Set the current state of security to allow SQL execution against the database.
   *
   * @param message - Any helpful message you see fit, will be appended to [[grants]].
   */
  allow?: (message: Message) => void;

  /**
   * Set the current start of security to deny SQL execution against the database.
   *
   * @param message - Any helpful message you see fit, will be appended to [[grants]].
   */
  deny?: (message: Message) => void;

  /**
   * View all the reasons security might have been [[allow]] or [[deny]].
   */
  grants?: Array<Grant>;

  /**
   * If a JWT token from an `Authorization: Bearer <token>` header has been successfully
   * decoded and verified, it will be here.
   */
  token?: object;

  /**
   * Put the current user identifier string here in order to integrate with database
   * user level secruity features. For exampe, in PostgreSQL, this property will be used as:
   *
   * `SET LOCAL SESSION AUTHORIZATION ${context.current_user}`
   */
  current_user?: string;

  /**
   * Put the current role identifier string here in order to integrate with database
   * role level secruity features. For exampe, in PostgreSQL, this property will be used as:
   *
   * `SET LOCAL ROLE ${context.role}`
   */
  role?: string;

  /**
   * The current unhandled exception error.
   */
  error?: Error;

  /**
   * Parameters may be on here for the default context. This will get
   * generated and specified with specific named parameters per SQLModule.
   */
  parameters?: SQLParameters;

  /**
   * Results may be on here for the default context. This will get generated
   * and specified per SQLModule.
   */
  results?: RowType[];
};

/**
 * A SQL query may have parameters, this type constrains them. This single
 * type defines the conceptual constraint, an can be further constrained
 * with specific type names extracted by parsing queries.
 */
export type SQLParameters = {
  [index: string]: SQLType;
};

/**
 * A single record coming back from a query -- one result from a result set.
 *
 * This is a conceptual type constraint, but individual SQL queries can be further
 * constrained with specific column names determined by parsing queries.
 */
export type SQLRow = {
  [index: string]: SQLType;
};

/**
 * Generic executor, parameters to resultset via a sql module.
 *
 * This is used to bridge the gap between generated in process clients, which will
 * have well defined parameter and result types, to the internal engine which is looser.
 *
 * In process clients execute via a function call, where out of process clients get this
 * genericicity from JSON serialization over HTTP.
 */
export type Executor = (parameters: SQLParameters) => Promise<SQLRow[]>;

/**
 * Context named executors. This is a map of functions to execute sql modules by the
 * `contextName` which is usefull unique way to address a given sql module in given
 * database in a flattened tree without worryng about / and such.
 */
export type Executors = {
  [index: string]: Executor;
};

/**
 * This map is the ability to go from a SQL module `contextName` to a function
 * that will let you really query the database.
 */
export type SQLModuleDirectExecutors = {
  /**
   * Store function mapping for query execution here.
   */
  directQueryExecutors: Executors;
};

export type DefaultContext = Context<SQLRow>;
export type DefaultContextualExecutor = (
  context: Context<DefaultContext>
) => Promise<DefaultContext>;
/**
 * A map of named, fully contextualized executors, complete
 * with handlers. This is used to wrap and mount the generated code in a runtime
 * server.
 */
export type ContextualSQLModuleExecutors = {
  [index: string]: DefaultContextualExecutor;
};

/**
 * An object with fully contextualized execution capability.
 */
export type HasContextualSQLModuleExecutors = {
  /**
   * `contextName` to function mapping. The idea is you get a fully enabled
   * execution chain for a given SQLModule, and use the function to actually
   * run a a SQLModule.
   */
  contextualSQLModuleExecutors: ContextualSQLModuleExecutors;
};
