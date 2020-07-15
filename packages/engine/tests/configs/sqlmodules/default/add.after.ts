import * as types from "../index";

export const after: types.default_addHandler = async (context) => {
  context.addResults(await context.databases.default.all());
};
