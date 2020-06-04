import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import {
  SQLModule,
  SQLTypeName,
  SQLColumnMetadata,
  SQLRow,
  SQLParameters,
} from "../shared-context";
import { DatabaseInternal, MigrationFile } from "../context";
import { Parser, AST } from "node-sql-parser";
import { identifier } from "../event-handlers";
import { SQLModuleInternal } from "../event-handlers/sqlmodule-pipeline";
import { Configuration } from "../configuration";

/**
 * Map SQLite to our neutral type strings.
 */
const typeMap = (fromSQLite: string): SQLTypeName => {
  switch (fromSQLite) {
    case "INT":
      return "number";
    default:
      return "string";
  }
};

/**
 * Embrace SQLite. Open it up and read the schema. This will create a database
 * if it does not exist.
 *
 * SQLite is a local file, so not a whole lot can go wrong. Except that a local file
 * can actually be a network file - so everything can go wrong...
 */
export default async (
  configuration: Configuration,
  databaseName: string
): Promise<DatabaseInternal> => {
  const dbUrl = configuration?.databases[databaseName];
  const filename = path.isAbsolute(dbUrl.pathname)
    ? dbUrl.pathname
    : path.normalize(path.join(configuration.embraceSQLRoot, dbUrl.pathname));
  // SQLite -- open is connection -- each database 'is' its own connection
  const database = await open({
    filename,
    driver: sqlite3.Database,
  });
  const transactions = {
    begin: async (): Promise<void> => {
      database.run("BEGIN IMMEDIATE TRANSACTION");
    },
    commit: async (): Promise<void> => {
      database.run("COMMIT");
    },
    rollback: async (): Promise<void> => {
      database.run("ROLLBACK");
    },
  };
  // TODO -- do we need SAVEPOINT / nesting?
  return {
    name: databaseName,
    transactions,
    SQLModules: {},
    parse: (sqlModule: SQLModule): AST[] | AST => {
      const parser = new Parser();
      const parsed = parser.astify(sqlModule.sql.trim(), {
        database: "postgresql",
      });
      return parsed;
    },
    execute: async (
      sqlModule: SQLModule,
      parameters?: SQLParameters
    ): Promise<SQLRow[]> => {
      const statement = await database.prepare(sqlModule.sql);
      if (parameters && Object.keys(parameters).length) {
        // map to SQLite names
        const withParameters = Object.fromEntries(
          Object.keys(parameters).map((name) => [`:${name}`, parameters[name]])
        );
        statement.bind(withParameters);
        return await statement.all();
      } else {
        return await statement.all();
      }
    },
    analyze: async (
      sqlModule: SQLModuleInternal
    ): Promise<Array<SQLColumnMetadata>> => {
      /**
       * This is a bit involved, taking each select, making a
       * temp table from it, inspecting, and tossing the temp table.
       *
       * This temp table 'figures out' the columns and types for us.
       */

      if (sqlModule.ast?.type === "select") {
        const parser = new Parser();
        const sql = parser.sqlify(sqlModule.ast, { database: "postgresql" });
        const create = `CREATE TABLE __analyze__ AS ${sql};`;
        const drop = `DROP TABLE __analyze__;`;
        const preparedCreate = await database.prepare(create);
        const describe = `pragma table_info('__analyze__')`;
        // run with all nulls for all parameters by default
        if (sqlModule.namedParameters?.length) {
          const withParameters = Object.fromEntries(
            sqlModule.namedParameters?.map((p) => [`:${p.name}`, null])
          );
          await preparedCreate.bind(withParameters);
          await preparedCreate.all();
        } else {
          await preparedCreate.all();
        }
        await preparedCreate.finalize();
        const readDescribeRows = await database.all(describe);
        await database.all(drop);
        // OK so something to know -- columns with spaces in them are quoted
        // by sqlite so if a column is named
        // hi mom
        // sqlite has that as 'hi mom'
        // which makes the javascript key ...["'hi mom'"] -- oh yeah
        // the ' is part of the key

        /**
         * One row per column, the name and type info are interesting,
         * pick them out and normalize them.
         */
        return readDescribeRows.map((row) => ({
          name: identifier(row.name.toString()),
          type: typeMap(row.type),
        }));
      } else {
        return [];
      }
    },
    migrate: async (migrationFile: MigrationFile): Promise<void> => {
      /**
       * Migrations want to run only once, we we'l need a tracking table to
       * mark of what's already been run.
       *
       * The script itself is what we don't want to 'run again'. The file name itself
       * isn't interesting except as a sort key.
       */
      await database.run(`CREATE TABLE IF NOT EXISTS __embracesql_migrations__ (
        content TEXT PRIMARY_KEY,
        run_at   INTEGER NOT NULL
      )`);
      const migrated = await (
        await database.all("SELECT content FROM __embracesql_migrations__")
      ).map((row) => row.content.toString());
      const markOff = await database.prepare(
        "INSERT INTO __embracesql_migrations__(content, run_at) VALUES(:content, :run_at)"
      );
      try {
        await transactions.begin();
        if (migrated.indexOf(migrationFile.content) >= 0) {
          // already done!
        } else {
          console.info("migrating", migrationFile.name);
          // time to migrate -- there might be multiple statements
          // and sqllite doesn't -- really allow that so we're gonna loop
          for (const bitOfBatch of migrationFile.content
            .split(";")
            .map((sql) => sql.trim())
            .filter((sql) => sql.length > 0)) {
            await database.run(bitOfBatch);
          }
          // and mark it off -- but mark off the whole batch
          await markOff.bind({
            ":content": migrationFile.content,
            ":run_at": Date.now(),
          });
          await markOff.all();
          // this ends up being needed to relase the create table locks
          await markOff.finalize();
        }
        await transactions.commit();
      } catch (e) {
        await transactions.rollback();
        throw e;
      }
    },
    close: async (): Promise<void> => {
      return database.close();
    },
  };
};
