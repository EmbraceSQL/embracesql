import { InternalContext, DatabaseInternalWithModules } from "../../context";
import md5 from "md5";
import { AutocrudModule } from "../../shared-context";
import generateCreate from "./generate-create";
import generateRead from "./generate-read";
import { identifier } from "..";

/**
 * Each autocrud module runs through the pipeline to generate each
 * component of CRUD.
 */
const autocrudModulePipeline = async (
  rootContext: InternalContext,
  database: DatabaseInternalWithModules,
  autocrudModule: AutocrudModule
): Promise<InternalContext> => {
  await generateCreate(rootContext, database, autocrudModule);
  await generateRead(rootContext, database, autocrudModule);
  return rootContext;
};

/**
 * AutoCRUD is much like a SQLModule, but doesn't read in from disk, instead it
 * reads from the database schem itself.
 */
export default async (
  rootContext: InternalContext
): Promise<InternalContext> => {
  // every database probably has tables, let's start there and generates
  // some skeletal autocrud modules
  const waitForAll = Object.keys(rootContext.databases).flatMap(
    async (databaseName) => {
      const database = rootContext.databases[databaseName];
      const tables = await database.schema();
      // collate each module by schema and name
      return tables.map(async (table) => {
        const restPath = table.schema
          ? `${table.schema}/${table.name}`
          : `${table.name}`;
        const module = (database.autocrudModules[restPath] = {
          ...table,
          restPath,
          cacheKey: md5(JSON.stringify(table.columns)),
          contextName: identifier(`${databaseName}/${restPath}`),
        });
        await autocrudModulePipeline(rootContext, database, module);
      });
    }
  );
  await Promise.all(waitForAll);
  return rootContext;
};
