import * as types from "../context";

export const after: types.default_addHandler = async (context) => {
  context.results = await context.databases.default.all();
  return context;
};
