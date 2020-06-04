/* eslint-disable @typescript-eslint/camelcase */

import * as context from "../../context";

/**
 * This contains base client types used as a seed for generation.
 *
 * The client differs from the server and event handlers in that
 * there is no context, these are 'normal' method invocations on a
 * structured object graph corresponding to all databases and
 * SQLModules. That's the word way of saying -- it makes objects with methods
 * you call with `.`.
 *
 * Even though this isn't really handlebars, it will be included in
 * handlebars so avoid mustaches.
 */

export const post = async (
  serverUrl: string,
  apiPath: string,
  parameters = {}
): Promise<Array<object>> => {
  const cleaned = serverUrl.endsWith("/") ? serverUrl.slice(0, -1) : serverUrl;
  // let any exception leak out to the client
  const response = await fetch(`${cleaned}${apiPath}`, {
    method: "POST",
    mode: "cors",
    cache: "no-cache",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    redirect: "follow",
    body: JSON.stringify(parameters),
  });
  const content = await response.json();
  if (response.ok) {
    return content;
  } else {
    throw Error(content.message);
  }
};
/**
 * Create an EmbraceSQL client bound to a specific URL.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const EmbraceSQL = (serverUrl: string) => {
  const DatabaseMap = {
    databases: {
      default: {
        hello: {
          sql: async (): Promise<context.default_helloRow[]> => {
            return (post(
              serverUrl,
              "/default/hello",
              {}
            ) as unknown) as context.default_helloRow[];
          },
        },
      },
    },
  };
  return DatabaseMap;
};
