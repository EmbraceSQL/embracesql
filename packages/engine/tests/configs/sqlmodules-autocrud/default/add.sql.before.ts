import * as types from "../context";

export const before: types.default_addHandler = async (context) => {
  // start a database transaction
  await context.databases.default.transactions.begin();
  // modify a passed in parameter by name
  context.parameters.name = context.parameters.name + "-ahem";
  return context;
};
