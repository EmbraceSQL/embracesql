// before handlers are exciting, as noted by three exclamation points added to the parameter

/* eslint-disable @typescript-eslint/camelcase */
import * as types from "../context";

export const before: types.default_helloHandler = async (context) => {
  context.parameters.stuff = context.parameters.stuff + "!!!";
  return context;
};
