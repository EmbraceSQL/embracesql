import * as types from "../index";

export const after: types.default_helloHandler = async (context) => {
  context.results = [...(context.results as []), ...(context.results as [])];
};
