import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import {
  SQLModule,
  SQLTypeName,
  SQLColumnMetadata,
  SQLRow,
  Configuration,
  SQLTableMetadata,
  AutocrudModule,
  SQLParameterSet,
  ParameterizedSQL,
} from "../../shared-context";
import { DatabaseInternal, MigrationFile } from "../../internal-context";
import { Parser, AST } from "node-sql-parser";
import { identifier } from "../../handlers";
import Url from "url-parse";
import pLimit from "p-limit";
import { buildReferentialGraph } from "..";
import { SQLModuleInternal } from "../../handlers/sqlmodule-pipeline";
const atomic = pLimit(1);

/**
 * SQLite metadata row.
 */
type MetadataRow = {
  name: string;
  type: string;
};

/**
 * Map SQLite to our neutral type strings.
 */
const typeMap = (fromSQLite: string): SQLTypeName => {
  switch (fromSQLite.toUpperCase()) {
    case "INT":
      return "number";
    case "INTEGER":
      return "number";
    default:
      return "string";
  }
};

/**
 * One row per column, the name and type info are interesting,
 * pick them out and normalize them.
 */
const columnMetadata = (
  readDescribeRows: MetadataRow[]
): SQLColumnMetadata[] => {
  // OK so something to know -- columns with spaces in them are quoted
  // by sqlite so if a column is named
  // hi mom
  // sqlite has that as 'hi mom'
  // which makes the javascript key ...["'hi mom'"] -- oh yeah
  // the ' is part of the key
  return readDescribeRows.map((row) => ({
    name: identifier(row.name),
    type: typeMap(row.type),
  }));
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
  databaseName: string,
  dbUrl: Url
): Promise<DatabaseInternal> => {
  const filename = path.isAbsolute(dbUrl.pathname)
    ? dbUrl.pathname
    : path.normalize(path.join(configuration.embraceSQLRoot, dbUrl.pathname));
  // SQLite -- open is connection -- each database 'is' its own connection
  const database = await open({
    filename,
    driver: sqlite3.Database,
  });
  // need to know the schema
  const schema = async (): Promise<SQLTableMetadata[]> => {
    const allTables = (
      await database.all(
        "SELECT name, sql FROM sqlite_master WHERE type='table'"
      )
    ).map((row) => ({ name: row.name as string, sql: row.sql as string }));
    const tableMetadata = allTables.map(async ({ name: table, sql }) => {
      const columns = await database.all(`PRAGMA TABLE_INFO('${table}')`);
      const relations = await database.all(
        `PRAGMA FOREIGN_KEY_LIST('${table}')`
      );
      const hasAutoincrement = sql.toLowerCase().indexOf("autoincrement") > 0;
      const keys = columnMetadata(columns.filter((row) => row.pk));
      return {
        // sqlte has no schemas in one database attaches
        schema: "",
        name: table,
        columns: columnMetadata(columns),
        keys,
        autoColumns: hasAutoincrement ? keys : [],
        references: relations.map((r) => ({
          toSchema: "",
          toTable: r.table,
          toColumns: r.to.split(","),
          fromSchema: "",
          fromTable: table,
          fromColumns: r.from.split(","),
        })),
        backReferences: [],
        relatedData: [],
      };
    });
    return await Promise.all(tableMetadata);
  };
  const tables = await schema();
  const uniqueSchemaNames = [...new Set(tables.map((t) => t.schema))];
  // group tables by schema -- there will be a 'no name' schema for SQLite
  const schemas = Object.fromEntries(
    uniqueSchemaNames.map((s) => [
      s,

      Object.fromEntries(
        tables.filter((t) => t.schema === s).map((t) => [t.name, t])
      ),
    ])
  );
  // build the referential graph for the tables in each schema
  await buildReferentialGraph(tables);
  // process transactions -- notice that SQLite doesn't allow 'normal nesting
  // so the SAVEPOINT system is used.
  const transactionStack = [];
  const transactions = {
    begin: async (): Promise<void> => {
      if (transactionStack.length == 0) {
        transactionStack.push("ROOT");
        return database.exec("BEGIN IMMEDIATE TRANSACTION");
      } else {
        const savepoint = `SAVE_${transactionStack.length}`;
        transactionStack.push(savepoint);
        return database.exec(`SAVEPOINT ${savepoint}`);
      }
    },
    commit: async (): Promise<void> => {
      const savepoint = transactionStack.pop();
      if (transactionStack.length === 0) {
        return database.exec("COMMIT");
      } else {
        return database.exec(`RELEASE SAVEPOINT ${savepoint}`);
      }
    },
    rollback: async (): Promise<void> => {
      const savepoint = transactionStack.pop();
      if (transactionStack.length === 0) {
        return database.exec("ROLLBACK");
      } else {
        return database.exec(`ROLLBACK TRANSACTION TO SAVEPOINT ${savepoint}`);
      }
    },
    depth: () => transactionStack.length,
  };
  return {
    name: databaseName,
    transactions,
    parse: (sqlModule: SQLModule): AST[] | AST => {
      const parser = new Parser();
      const parsed = parser.astify(sqlModule.sql.trim(), {
        database: "postgresql",
      });
      return parsed;
    },
    execute: async (
      sqlModule: ParameterizedSQL,
      parameters?: SQLParameterSet
    ): Promise<SQLRow[]> => {
      // execution wrapper to get transaction support
      const execute = async (): Promise<SQLRow[]> => {
        const statement = await database.prepare(sqlModule.sql);
        try {
          if (sqlModule.namedParameters.length) {
            // map to SQLite names -- pull in from expected parameters
            const withParameters = Object.fromEntries(
              sqlModule.namedParameters.map(({ name }) => [
                `:${name}`,
                parameters[name],
              ])
            );
            await statement.bind(withParameters);
            return await statement.all();
          } else {
            return await statement.all();
          }
        } finally {
          await statement.finalize();
        }
      };
      return execute();
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
        const create = `CREATE TEMPORARY TABLE __analyze__ AS ${sql};`;
        const drop = `DROP TABLE __analyze__;`;
        const preparedCreate = await database.prepare(create);
        try {
          const describe = `PRAGMA TABLE_INFO('__analyze__')`;
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
          const readDescribeRows = await database.all(describe);
          await database.all(drop);
          return columnMetadata(readDescribeRows);
        } finally {
          await preparedCreate.finalize();
        }
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
      try {
        const markOff = await database.prepare(
          "INSERT INTO __embracesql_migrations__(content, run_at) VALUES(:content, :run_at)"
        );
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
    /**
     * AutoCRUD query generation.
     */
    readLastKeySQL: async (autocrudModule: AutocrudModule): Promise<string> => {
      const readbackKeyString = autocrudModule.resultsetMetadata
        .map((c) => c.name)
        .join(",");
      // readback with the special column rowid for single crud inserts
      return `SELECT ${readbackKeyString} FROM ${autocrudModule.name} WHERE ROWID=last_insert_rowid()`;
    },
    atomic,
    schemas,
  };
};
