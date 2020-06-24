import {
  InternalContext,
  DatabaseInternalWithModules,
} from "../../internal-context";
import {
  AutocrudModule,
  Context,
  SQLRow,
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
  const module = (database.modules[restPath] = {
    ...autocrudModule,
    contextName: identifier(`${database.name}/${restPath}`),
    restPath,
    namedParameters,
    // read back the keys
    resultsetMetadata: autocrudModule.keys,
    canModifyData: true,
  });
  const columnString = module.namedParameters.map((c) => c.name).join(",");
  const parameterString = module.namedParameters
    .map((c) => `:${c.name}`)
    .join(",");
  const create = `INSERT INTO ${autocrudModule.name}(${columnString}) VALUES(${parameterString});`;
  const readBack = await database.readLastKeySQL(module);
  // and with an executor to run the thing
  rootContext.moduleExecutors[module.contextName] = {
    database,
    module,
    executor: async (context: Context): Promise<Context> => {
      const doOne = async (parameters: SQLParameterSet): Promise<SQLRow> => {
        // this needs to be atomic so our read back goes right after our insert
        // and no other query can sneak in between
        return await database.atomic(async () => {
          // make the row -- nothing to read here
          const immediateParameters = validParameters(module, parameters);
          await database.execute(create, immediateParameters);
          // and the keys come back -- no parameters needed -- use the DB 'last inserted row' capability
          // take advantage of the fact we are in the same transaction and connection
          const readBackKeys = await database.execute(readBack);
          return readBackKeys[0];
        });
      };
      if (context.parameters.length) {
        const updates = context.parameters.map(doOne);
        context.results = await Promise.all(updates);
      } else {
        throw new Error("no parameters");
      }
      return context;
    },
  };
  return rootContext;
};
