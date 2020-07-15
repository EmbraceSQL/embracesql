import * as types from "../index";

export const after: types.default_helloHandler = async (context) => {
  context.addResults(context.results);
};
