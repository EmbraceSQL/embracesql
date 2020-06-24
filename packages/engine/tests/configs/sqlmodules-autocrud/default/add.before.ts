import * as types from "../index";

export const before: types.default_addHandler = async (context) => {
  // start a database transaction
  await context.databases.default.transactions.begin();
  // modify a passed in parameter by name
  context.parameters.forEach((p) => (p.name = p.name + "-ahem"));
};
