import { InternalContext } from "../../context";
import { generateFromTemplates } from "../../generator";

/**
 * Stitch together all the individual SQLModules into final templates.
 *
 * @rootContext - as usual, our root context
 */
export default async (
  rootContext: InternalContext
): Promise<InternalContext> => {
  await generateFromTemplates(Object.assign({}, rootContext), "root", true);
  return rootContext;
};
