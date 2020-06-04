/* eslint-disable @typescript-eslint/camelcase */
import * as types from "../context";

export const after: types.FolderHandler = async (context) => {
  // even MOAR results
  context.results = [...context.results, ...context.results];
  return context;
};
