import { InternalContext } from "../../context";
import md5 from "md5";
import { identifier } from "..";

/**
 * AutoCRUD is much like a SQLModule, but doesn't read in from disk, instead it
 * reads from the database schem itself.
 */
export default async (
  rootContext: InternalContext
): Promise<InternalContext> => {
  // every database probably has tables, let's start there and generates
  // some skeletal autocrud modules
  const waitForAll = Object.keys(rootContext.databases).map(
    async (databaseName) => {
      const database = rootContext.databases[databaseName];
      const tables = await database.schema();
      // collate each module by schema and name
      tables.forEach((table) => {
        const compressedTreePath = table.schema
          ? `${table.schema}/${table.name}`
          : table.name;
        database.AutocrudModules[compressedTreePath] = {
          ...table,
          restPath: table.schema.length
            ? `${databaseName}/autocrud/${table.schema}/${table.name}`
            : `${databaseName}/autocrud/${table.name}`,
          cacheKey: md5(JSON.stringify(table.columns)),
          contextName: identifier(
            `${databaseName}_${table.schema}_${table.name}`
          ),
        };
      });
    }
  );
  await Promise.all(waitForAll);
  return rootContext;
};
