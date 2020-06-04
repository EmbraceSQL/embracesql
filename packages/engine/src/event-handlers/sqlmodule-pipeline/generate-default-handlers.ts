import { InternalContext } from "../../context";
import { generateFromTemplates } from "../../generator";
import { SQLModuleInternal } from ".";
import path from "path";

/**
 * Every SQL file needs its handlers. This will make sure those handler
 * skeletons exist as nice empty handlers you just fill in.
 *
 * @param rootContext - as usual, our root context
 * @param SQLFileName - full file path to a single SQL
 */
export default async (
  rootContext: InternalContext,
  sqlModule: SQLModuleInternal
): Promise<InternalContext> => {
  // smells like SQLSpirit...
  if (sqlModule.ast) {
    await generateFromTemplates(
      Object.assign({}, rootContext, {
        // generating handlers for this module
        module: sqlModule,
        // relative path in each handler used for import statements of other generated code
        relativeToRoot: path.relative(
          path.dirname(sqlModule.fullPath),
          rootContext.configuration.embraceSQLRoot
        ),
      }),
      "handlers"
    );
  }
  // folder level handlers that are not module specific -- walk up the tree
  // and drop handlers in each folder, this ends up forming the handler 'chain'p
  const waitForThem = sqlModule.beforeHandlerPaths.map(async (folderPath) => {
    const fullFolderPath = path.resolve(
      path.join(rootContext.configuration.embraceSQLRoot, folderPath)
    );
    return generateFromTemplates(
      Object.assign({}, rootContext, {
        // dropping the handlers here
        folderPath: fullFolderPath,
        // relative path to the handler so we can do imports of other enerated code
        relativeToRoot: path.relative(
          fullFolderPath,
          rootContext.configuration.embraceSQLRoot
        ),
      }),
      "folder-handlers"
    );
  });
  await Promise.all(waitForThem);
  return rootContext;
};
