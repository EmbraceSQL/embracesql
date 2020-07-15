import { Database, ContextualExecutor } from "./shared-context";

/**
 * Execute wrapped in a transaction. Roll back on any leaking exception, commit if the depth only went
 * up by one -- i.e. is this the 'only' transaction.
 *
 * This is where we really start talking to the database.
 */
export const withTransaction = async <T>(
  database: Database,
  executor: ContextualExecutor<T>,
  context: T
): Promise<T> => {
  const startingDepth = database.transactions.depth();
  try {
    await database.transactions.begin();
    const resultContext = await executor(context);
    // if we are balanced -- commit
    if (database.transactions.depth() == startingDepth + 1) {
      await database.transactions.commit();
    } else {
      await database.transactions.rollback();
    }
    // return always -- it's OK to return uncommitted data
    return resultContext;
  } catch (e) {
    await database.transactions.rollback();
    throw e;
  }
};
