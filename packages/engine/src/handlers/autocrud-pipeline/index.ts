import { InternalContext } from "../../context";

/**
 * AutoCRUD is much like a SQLModule, but doesn't read in from disk, instead it
 * reads from the database schem itself.
 */
export default async (
  rootContext: InternalContext
): Promise<InternalContext> => {
  // every database probably has tables, let's start there
  const waitForAll = Object.keys(rootContext.databases).map(
    async (databaseName): Promise<void> => {
      const database = rootContext.databases[databaseName];
      const tables = await database.schema();
      console.log(tables);
    }
  );
  await Promise.all(waitForAll);
  return rootContext;
};
