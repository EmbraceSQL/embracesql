/* eslint-disable @typescript-eslint/no-unused-vars */
import { InternalContext, DatabaseInternal } from "../../context";
import { SQLModuleInternal } from ".";

/**
 * Looking for parameters? Need to be able to spot them!
 */
type MaybeAParameter = object & {
  type?: string;
  value?: string;
};

/**
 * Parameters have types too.
 *
 * @param rootContext - as usual, our root context
 * @param database - the database to use
 * @param sqlModules - the sql module to inspect
 */
export default async (
  rootContext: InternalContext,
  _database: DatabaseInternal,
  sqlModule: SQLModuleInternal
): Promise<InternalContext> => {
  // descend the AST and pick out all the parameters we can find
  const traverse = (o: MaybeAParameter): Array<string> => {
    if (o?.type === "param") {
      // if this is a param -- fantastic, we are at a terminal and return a name
      return [o.value];
    } else if (o instanceof Array) {
      // an array -- let's assume these might be objects
      return (o as Array<object>).flatMap((e) => traverse(e));
    } else if (o instanceof Object) {
      // if an object -- let's look at all the properties actually 'on it' --
      // don't get confused by proptotypes...
      return Object.keys(o || {})
        .filter((key) => o.hasOwnProperty(key))
        .flatMap((key) => traverse(o[key]));
    } else {
      return [];
    }
  };
  const namedParameters = traverse(sqlModule.ast);
  // TODO -- how on earth do you figure out parameter types!
  // all the parameters, string is the default and can be mutated later
  sqlModule.namedParameters = namedParameters.map((p) => ({
    name: p,
    type: "string",
  }));
  return rootContext;
};
