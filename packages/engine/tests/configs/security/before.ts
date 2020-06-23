// folder level
import * as types from "./context";

export const before: types.FolderHandler = async (context) => {
  // secure by default -- deny all
  context.deny();
};
