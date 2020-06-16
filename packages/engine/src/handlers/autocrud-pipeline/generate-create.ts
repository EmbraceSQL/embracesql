import { InternalContext, DatabaseInternalWithModules } from "../../context";
import {
  AutocrudModule,
  Context,
  SQLRow,
  isSQLParameterSet,
  isSQLParameterSetBatch,
  SQLParameterSet,
} from "../../shared-context";
import { identifier } from "..";
import { validParameters } from "../../database-engines";

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
  const restPath = `${autocrudModule.restPath}/create`;
  // the input parameters -- are the schema minus any autoincrement
  // normal keys are allowed -- needed even!
  const namedParameters = autocrudModule.columns.filter(
    (column) =>
      !autocrudModule.autoColumns.map((c) => c.name).includes(column.name)
  );
  const createModule = (database.autocrudModules[restPath] = {
    ...autocrudModule,
    contextName: identifier(`${database.name}/${restPath}`),
    restPath,
    namedParameters,
    // inserted columns will be 1-1 with parameters
    workOnTheseColumns: namedParameters,
    // read back the keys
    resultsetMetadata: autocrudModule.keys,
    canModifyData: true,
  });
  // and with an executor to run the thing
  const queries = await database.createSQL(createModule);
  rootContext.autocrudModuleExecutors[createModule.contextName] = {
    autocrudModule: createModule,
    executor: async (context: Context): Promise<Context> => {
      const doOne = async (parameters: SQLParameterSet): Promise<SQLRow> => {
        // this needs to be atomic so our read back goes right after our insert
        // and no other query can sneak in between
        return await database.atomic(async () => {
          // make the row -- nothing to read here
          await database.execute(
            queries.create,
            validParameters(createModule, parameters)
          );
          // and the keys come back -- no parameters needed -- use the DB 'last inserted row' capability
          // take advantage of the fact we are in the same transaction and connection
          const readBackKeys = await database.execute(queries.readback);
          return readBackKeys[0];
        });
      };
      if (isSQLParameterSetBatch(context.parameters)) {
        const updates = (context.parameters as SQLParameterSet[]).map(doOne);
        context.results = await Promise.all(updates);
      } else if (isSQLParameterSet(context.parameters)) {
        context.results = [await doOne(context.parameters)];
      } else {
        throw new Error("no parameters");
      }
      return context;
    },
  };
  return rootContext;
};
