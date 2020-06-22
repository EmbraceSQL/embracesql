import * as types from "../context";

export const before: types.default_addHandler = async (context) => {
  context.parameters.forEach((p) => (p.name = p.name + "-ahoy"));
};
