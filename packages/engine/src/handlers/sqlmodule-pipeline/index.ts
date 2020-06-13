import { SQLModule } from "../../shared-context";
import parseSQL from "./parse-sql";
import transformResultTypes from "./transform-result-types";
import transformParameterTypes from "./transform-parameter-types";
import generateDefaultHandlers from "./generate-default-handlers";
import bindExecutors from "./bind-executors";
import type { AST } from "node-sql-parser";
import walk from "ignore-walk";
import path from "path";
import md5 from "md5";
import fs from "fs-extra";
import { identifier } from "../index";
import { InternalContext, DatabaseInternal } from "../../context";

/**
 * Inside the EmbraceSQL exgine extension to the SQLModule type.
 */
export type SQLModuleInternal = SQLModule & {
  /**
   * Parsed SQL abstract syntax tree, one AST, only one statement is allowed.
   */
  ast?: AST;
};

/**
 * Each SQLModule runs through a transformation pipeline. This differs slightly
 * from a nominal compiler in that each stage of the pipeline can update a shared
 * context, as well as emit additional files.
 */
const sqlModulePipeline = async (
  rootContext: InternalContext,
  database: DatabaseInternal,
  sqlModule: SQLModule
): Promise<InternalContext> => {
  const sqlModuleInternal = sqlModule as SQLModuleInternal;
  try {
    // await makes this a lot less goofy than a promise chain
    await parseSQL(rootContext, database, sqlModuleInternal);
    await transformParameterTypes(rootContext, database, sqlModuleInternal);
    await transformResultTypes(rootContext, database, sqlModuleInternal);
    await generateDefaultHandlers(rootContext, sqlModuleInternal);
    await bindExecutors(rootContext, database, sqlModuleInternal);
  } catch (e) {
    // a single module failing isn't fatal, it's gonna happen all the type with typos
    console.warn(sqlModule.fullPath, e.message);
  }
  return rootContext;
};

/**
 * Manage a directory of event handlers, which form the basis of APIs
 *
 * All SQL files in the directory serve as entry points. The process is to enumerate
 * all of these SQL files and build an in memory file system analog with hashes
 * to be used as cache keys.
 *
 * * Loads up and hashes all sql files found
 * * Creates a database specific wrapper for invoking each SQL.
 * * Makes sure all the needed event handlers are generated
 *
 * @param rootContext - like other internal methods, run off the root context
 */
export default async (
  rootContext: InternalContext
): Promise<InternalContext> => {
  // this should be the only place where a file walk happens
  const fileNames = await walk({
    ignoreFiles: [".sqlmoduleignore"],
    path: rootContext.configuration.embraceSQLRoot,
  });
  // just the SQL files
  const sqlFileNames = await fileNames.filter((fileName) =>
    fileName.toLowerCase().endsWith(".sql")
  );
  // root folders are databases, so attach there
  const allSQLModules = await sqlFileNames.map(async (SQLFileName) => {
    const parsedPath = path.parse(SQLFileName);
    const segments = parsedPath.dir
      .split(path.sep)
      .map((segment) => identifier(segment));
    // database is the first segment
    const databaseName = segments[0];
    // tail end of the path after the database, cleaned up names
    // to be identifiers -- path separator in the URl style
    const pathAfterDatabase = [...segments.slice(1), parsedPath.name]
      .map(identifier)
      .join("/");
    // working with full paths from here on out, one less thing to worry about
    const fullPath = path.join(
      rootContext.configuration.embraceSQLRoot,
      SQLFileName
    );
    const restPath = SQLFileName.replace(/\.sql$/, "");
    // take the path segments and build up a path list
    const handlerPaths = segments.map((_segment, index, array) => {
      return path.join(...array.slice(0, index + 1));
    });
    // get all the 'read' IO done
    const sql = await fs.readFile(fullPath, "utf8");
    // data about each SQL module
    const sqlModule = {
      restPath,
      fullPath,
      // before handlers run from the root down toward the sql file
      beforeHandlerPaths: handlerPaths,
      // and after handlers are in reverse, from the sql file back toward the root
      afterHandlerPaths: [...handlerPaths].reverse(),
      sql,
      cacheKey: md5(sql),
      contextName: identifier(path.join(parsedPath.dir, parsedPath.name)),
      namedParameters: [],
      resultsetMetadata: [],
      canModifyData: false,
    };
    // collate each module by the containing database
    rootContext.databases[databaseName].sqlModules[
      pathAfterDatabase
    ] = sqlModule;
    return sqlModule;
  });
  // checkpoint -- wait for finish
  await Promise.all(allSQLModules);
  // with all sql modules enumerated time to build up metadata from each database
  const allDatabases = Object.values(rootContext.databases).flatMap(
    async (database) => {
      try {
        // one big transaction around all oof our module building
        // so we can roll back and know we didn't modify our database
        database.transactions.begin();
        const waitForThem = Object.values(
          database.sqlModules
        ).map(async (sqlModule) =>
          sqlModulePipeline(rootContext, database, sqlModule)
        );
        await Promise.all(waitForThem);
        return database;
      } finally {
        database.transactions.rollback();
      }
    }
  );
  // let them all finish
  await Promise.all(allDatabases);
  return rootContext;
};
