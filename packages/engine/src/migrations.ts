import { InternalContext } from "./context";
import path from "path";
import walk from "ignore-walk";
import readFile from "read-file-utf8";
import limit from "p-limit";

// migrations will be serial
const oneAtATime = limit(1);

/**
 * Run migrations for all databases. Each database is contained in its
 * own transaction.
 */
export const migrate = async (rootContext: InternalContext): Promise<void> => {
  // databases can go in any order, so let's just do them in config order
  for (const databaseName of Object.keys(rootContext.databases)) {
    // migrations are in a well known path for each database
    const migrationPath = path.join(
      rootContext.configuration.embraceSQLRoot,
      "migrations",
      databaseName
    );
    // love tha walk method!
    const migrationFileNames = await walk({ path: migrationPath });
    const migrationFiles = migrationFileNames
      .map((fileName) => path.join(migrationPath, fileName))
      .filter((fileName) => fileName.endsWith(".sql")) // only sql files
      .sort() // migrations are ordered for each database
      .map(async (fullMigrationFilename) => ({
        name: fullMigrationFilename,
        content: (await readFile(fullMigrationFilename)).trim(),
      }))
      .map(async (migrationSQLScriptFile) => {
        return oneAtATime(async () => {
          return await rootContext.databases[databaseName].migrate(
            await migrationSQLScriptFile
          );
        });
      });
    await Promise.all(migrationFiles);
  }
};
