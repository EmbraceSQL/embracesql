import { InternalContext, DatabaseInternal } from "../../context";
import { SQLModuleInternal } from ".";
import { AST } from "node-sql-parser";

/**
 * Parse the SQL in a module, extracting the abstract syntax tree
 * and all of the parameters
 *
 * @param rootContext - as usual, our root context
 * @param database - parse using this specific database
 * @param sqlModule - parse and update this module
 */
export default async (
  rootContext: InternalContext,
  database: DatabaseInternal,
  sqlModule: SQLModuleInternal
): Promise<InternalContext> => {
  const ast = database.parse(sqlModule);
  if (((ast as unknown) as AST[])?.length > 1) {
    // we are only supporting single statements
    throw new Error("Only one SQL statement is supported per .sql file.");
  } else if (((ast as unknown) as AST[]).length === 1) {
    // single item arrays are OK
    sqlModule.ast = ast[0];
  } else {
    // and a raw, non array is AST is OK -- this gets returned from single SELECTS with no ;
    // when using node-sql-parser
    sqlModule.ast = ast as AST;
  }
  sqlModule.canModifyData = sqlModule.ast.type !== "select";
  return rootContext;
};
