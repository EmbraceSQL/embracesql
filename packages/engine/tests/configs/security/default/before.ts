import * as types from "../index";

export const before: types.FolderHandler = async (context) => {
  // secure by default
  context.deny();
  // a token from a public provider, validate the email domain
  // this would be an approach if you were using Google Cloud or Azure Active Directory
  if (context.token && /.*@hence.com$/.test(context.token.email)) {
    // note you can pass 'any' object, string, array, or object with key/value
    // here we use a string
    context.allow("user from domain granted");
  }
  // if there is no context, or no match, we stick with the root deny
};
