import {
  InternalContext,
  DatabaseInternalWithModules,
} from "../../internal-context";
import md5 from "md5";
import { AutocrudModule } from "../../shared-context";
import generateCreate from "./generate-create";
import generateRead from "./generate-read";
import generateReadWithRelated from "./generate-read-with-related";
import generateUpdate from "./generate-update";
import generateDelete from "./generate-delete";
import { identifier } from "..";
import path from "path";

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
  await generateUpdate(rootContext, database, autocrudModule);
  await generateDelete(rootContext, database, autocrudModule);
  await generateReadWithRelated(rootContext, database, autocrudModule);
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
  for (const database of Object.values(rootContext.databases)) {
    for (const schema of Object.values(database.schemas)) {
      for (const table of Object.values(schema)) {
        // rest paths follow a common schema that matches the notion
        // of the database as a file system with database/schema/table
        const segments = table.schema
          ? ["autocrud", table.schema, table.name]
          : ["autocrud", table.name];
        const restPath = segments.join(path.sep);
        const handlerPaths = [".", ...segments].map(
          (_segment, index, array) => {
            // path join isn't handling leading "."
            return array.slice(0, index + 1).join(path.sep);
          }
        );
        // here is a basic module representing the table - this isn't a specific autocrud operation
        // so this module isn't attached to the database, it is just a free floating variable that will
        // be forgotten
        const module = {
          ...table,
          restPath,
          // before handlers run from the root down toward the sql file
          beforeHandlerPaths: handlerPaths,
          // and after handlers are in reverse, from the sql file back toward the root
          afterHandlerPaths: [...handlerPaths].reverse(),
          cacheKey: md5(JSON.stringify(table.columns)),
          contextName: identifier(`${database.name}/${restPath}`),
          namedParameters: [],
          resultsetMetadata: [],
          canModifyData: false,
        };
        // expand this in effect 'template' module -- into modules for operations
        await autocrudModulePipeline(rootContext, database, module);
      }
    }
  }

  return rootContext;
};
