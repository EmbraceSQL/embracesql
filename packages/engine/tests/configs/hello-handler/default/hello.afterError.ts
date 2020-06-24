import * as types from "../index";

export const afterError: types.default_helloHandler = async (context) => {
  // see what happened and print it out, the error is on the context
  console.log(context.error);
  // do nothing and the error 'counts'

  // optionally 'eat' the error
  context.error = undefined;

  // raise it again -- or any error and the transaction aborts
  // throw "Oh! Noes!";
};
