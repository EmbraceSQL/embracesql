import { InternalContext, DatabaseInternalWithModules } from "../../context";
import { AutocrudModule } from "../../shared-context";
import { identifier } from "..";

/**
 * Generate a create method. This will generate another autocrud
 * module and add it to the database.
 *
 * This will accept and entire record of parameters, and return
 * the primary key. This takes two queries!
 */
export default async (
  rootContext: InternalContext,
  database: DatabaseInternalWithModules,
  autocrudModule: AutocrudModule
): Promise<InternalContext> => {
  // create
  const restPath = `${autocrudModule.restPath}/create`;
  // the input parameters -- are the schema minus any autoincrement
  const namedParameters = autocrudModule.columns.filter(
    (column) =>
      !autocrudModule.autoColumns.map((c) => c.name).includes(column.name)
  );
  database.autocrudModules[restPath] = {
    ...autocrudModule,
    contextName: identifier(`${database.name}/${restPath}`),
    restPath,
    namedParameters,
    resultsetMetadata: autocrudModule.columns,
    canModifyData: true,
  };
  return rootContext;
};
