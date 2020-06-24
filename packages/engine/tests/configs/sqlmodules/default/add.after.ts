import * as types from "../index";

export const after: types.default_addHandler = async (context) => {
  context.results = await context.databases.default.all();
};
