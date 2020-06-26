import * as types from "../../index";

export const before: types.FolderHandler = async (context) => {
  // secure by default
  context.deny();
  // a token from a public provider, validate the email domain
  // this would be an approach if you were using Google Cloud or Azure Active Directory
  if (context.token) {
    // pick off the back half of the email, and throw an exception otherwise
    const domain = context.token.email.split("@")[1];
    // issue a query to get the tenant
    // and add it to the context parameters -- matching the named parameter in my_things.sql
    // notice you don't need to tell it a row, or iterate rows here -- just a little convenience!
    const { tenant_id } = await context.databases.default.multitenant.tenant({
      domain,
    });
    // parameters are array valued -- but there is a convenience built in
    // to let you bulk set -- just--- set!
    context.parameters.tenant_id = tenant_id;
    context.allow({
      domain,
      tenant_id,
    });
  }
  // if there is no context, or no match, we stick with the root deny
};
