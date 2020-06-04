import { InternalContext, DatabaseInternal } from "../../context";
import { SQLModule } from "../../shared-context";
import parseSQL from "./parse-sql";
import transformResultTypes from "./transform-result-types";
import transformParameterTypes from "./transform-parameter-types";
import generateDefaultHandlers from "./generate-default-handlers";
import type { AST } from "node-sql-parser";

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
export default async (
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
  } catch (e) {
    // a single module failing isn't fatal, it's gonna happen all the type with typos
    console.warn(sqlModule.fullPath, e.message);
  }
  return rootContext;
};
