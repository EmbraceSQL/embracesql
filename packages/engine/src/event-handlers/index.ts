import { InternalContext, DatabaseInternal } from "../context";
import readFile from "read-file-utf8";
import walk from "ignore-walk";
import path from "path";
import md5 from "md5";
import sqlModulePipeline from "./sqlmodule-pipeline";
import contextPipeline from "./context-pipeline";
import limit from "p-limit";

// thottling
const oneAtATime = limit(1);

/**
 * Scrub up identifiers to be valid JavaScript names.
 */
export const identifier = (key: string): string => {
  const id = key
    .trim()
    // quotes won't do
    .replace(/['"]+/g, "")
    // snake case
    .replace(/\W+/g, "_");
  return /^\d/.test(id) ? "_" + id : id;
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
export const embraceEventHandlers = async (
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
    const sql = await readFile(fullPath);
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
    };
    // collate each module by the containing database
    rootContext.databases[databaseName].SQLModules[
      pathAfterDatabase
    ] = sqlModule;
    return sqlModule;
  });
  // checkpoint -- wait for finish
  await Promise.all(allSQLModules);
  // with all sql modules enumerated time to build up metadata from each database
  const allDatabases = Object.values(rootContext.databases).flatMap(
    async (database: DatabaseInternal) => {
      try {
        // one big transaction around all oof our module building
        // so we can roll back and know we didn't modify our database
        database.transactions.begin();
        // one at a time iteration -- our database isn't re-entrant
        const waitForThem = Object.values(
          database.SQLModules
        ).map(async (sqlModule) =>
          oneAtATime(
            async () =>
              await sqlModulePipeline(rootContext, database, sqlModule)
          )
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
  // stitch together the full context and final combined files
  // this is the 'pack' phase
  await contextPipeline(rootContext);
  return rootContext;
};
