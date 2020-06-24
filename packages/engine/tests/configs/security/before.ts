// folder level
import * as types from "./index";

export const before: types.FolderHandler = async (context) => {
  // secure by default -- deny all
  context.deny();
};
