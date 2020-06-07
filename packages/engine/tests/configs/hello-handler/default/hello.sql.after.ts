// double results === double fun
import * as types from "../context";

export const after: types.default_helloHandler = async (context) => {
  context.results = [...context.results, ...context.results];
  return context;
};
