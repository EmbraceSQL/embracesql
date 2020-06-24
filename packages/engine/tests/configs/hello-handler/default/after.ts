import * as types from "../index";

export const after: types.FolderHandler = async (context) => {
  // even MOAR results
  context.results = [...(context.results as []), ...(context.results as [])];
};
