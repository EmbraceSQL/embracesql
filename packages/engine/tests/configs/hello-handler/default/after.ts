import * as types from "../index";

export const after: types.FolderHandler = async (context) => {
  // even MOAR results
  context.addResults(context.results);
};
