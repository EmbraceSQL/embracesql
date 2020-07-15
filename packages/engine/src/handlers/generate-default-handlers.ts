import { InternalContext } from "../internal-context";
import { generateFromTemplates } from "../generator";
import path from "path";
import { CommonDatabaseModule } from "../shared-context";

/**
 * Every SQL file needs its handlers. This will make sure those handler
 * skeletons exist as nice empty handlers you just fill in.
 *
 * @param rootContext - as usual, our root context
 * @param module - generate handlers for this module
 */
export default async (
  rootContext: InternalContext,
  module: CommonDatabaseModule
): Promise<InternalContext> => {
  // figure the .. s to import back up to root for any given handler
  const relativeToRoot = path.relative(
    path.join(rootContext.configuration.embraceSQLRoot, module.restPath, ".."),
    rootContext.configuration.embraceSQLRoot
  );
  await generateFromTemplates(
    Object.assign({}, rootContext, {
      // generating handlers for this module
      module: module,
      // relative path in each handler used for import statements of other generated code
      relativeToRoot: relativeToRoot === "" ? "." : relativeToRoot,
    }),
    "handlers"
  );

  // folder level handlers that are not module specific -- walk up the tree
  // and drop handlers in each folder, this ends up forming the handler 'chain'p
  const waitForThem = module.beforeHandlerPaths.map(async (folderPath) => {
    const fullFolderPath = path.resolve(
      path.join(rootContext.configuration.embraceSQLRoot, folderPath)
    );
    const relativeToRoot = path.relative(
      fullFolderPath,
      rootContext.configuration.embraceSQLRoot
    );
    return generateFromTemplates(
      Object.assign({}, rootContext, {
        // dropping the handlers here
        folderPath: fullFolderPath,
        // relative path to the handler so we can do imports of other enerated code
        relativeToRoot: relativeToRoot === "" ? "." : relativeToRoot,
      }),
      "folder-handlers"
    );
  });
  await Promise.all(waitForThem);
  return rootContext;
};
