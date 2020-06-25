import * as types from "../index";

export const before: types.default_helloHandler = async (context) => {
  // destructure the token if you like
  if (context.token) {
    const { sub, iat } = context?.token;
    console.log(sub, iat);
    // or hey -- here is a whole token
    console.log(context.token);
  }
};
