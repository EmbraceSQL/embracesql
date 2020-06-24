import * as types from "../index";

export const before: types.default_helloHandler = async (context) => {
  context.parameters.forEach((p) => (p.stuff = p.stuff + "!!!"));
};
