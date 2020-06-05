import * as types from "../context";

export const before: types.default_addHandler = async (context) => {
  context.parameters.name = context.parameters.name + "-ahoy";
  return context;
};
