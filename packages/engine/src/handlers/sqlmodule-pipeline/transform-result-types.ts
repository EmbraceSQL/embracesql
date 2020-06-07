import { InternalContext, DatabaseInternal } from "../../context";
import { SQLModuleInternal } from ".";

/**
 * Run the query -- but in a transaction so the database doesn't get
 * modified. This allows an inspection of the resultset(s) to figure out
 * columns and types.
 *
 * @rootContext - as usual, our root context
 * @param SQLFileName - full file path to a single SQL
 */
export default async (
  rootContext: InternalContext,
  database: DatabaseInternal,
  sqlModule: SQLModuleInternal
): Promise<InternalContext> => {
  // check if the metadata already exists -- Autocrud will come equipped with
  // so there is no need to 'double check'
  if (!sqlModule.resultsetMetadata) {
    sqlModule.resultsetMetadata = await database.analyze(sqlModule);
  }
  return rootContext;
};
