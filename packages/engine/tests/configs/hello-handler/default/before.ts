// folder level
import * as types from "../context";

export const before: types.FolderHandler = async (context) => {
  // simulated error
  if (context.parameters[0]?.stuff === "error") {
    throw new Error("Simulated Error -- this is expected");
  }
};
