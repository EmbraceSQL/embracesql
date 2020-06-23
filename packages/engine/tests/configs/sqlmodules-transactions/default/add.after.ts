import * as types from "../context";

export const after: types.default_addHandler = async (context) => {
  // run a SQL module inline, no parameters
  context.results = await context.databases.default.all({});
  // do not commit, as this is commented out
  // note that by this time we have already done the insert
  // and queried the database
  // await context.databases.default.transactions.commit();
  // we could also explicitly rollback, but this will happen on its own
  // await context.databases.default.transactions.rollback();
};
