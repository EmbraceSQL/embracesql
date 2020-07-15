import { InternalContext } from "../../internal-context";

/**
 * Apply authorization rules with this layer. If we are in a state of 'deny', throw
 * and do not proceed.
 * up by one -- i.e. is this the 'only' transaction.
 *
 */
export default async (
  rootContext: InternalContext
): Promise<InternalContext> => {
  for (const executableModule of Object.values(rootContext.moduleExecutors)) {
    // replace the module executor with a transaction wrapper
    const inner = executableModule.executor;
    // let the type inference flow
    executableModule.executor = async (context) => {
      const currentGrant = context.grants[context.grants.length - 1];
      if (currentGrant?.type === "deny") throw new Error("Unauthorized");

      // proceed as normal
      return inner(context);
    };
  }

  return rootContext;
};
