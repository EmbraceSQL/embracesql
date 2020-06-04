/* eslint-disable @typescript-eslint/no-namespace */
import path from "path";
import fs from "fs-extra";
import { loadConfiguration, Configuration } from "../src/configuration";
import { buildInternalContext, InternalContext } from "../src/context";
import { createServer } from "../src/server";
import request from "supertest";
import readFile from "read-file-utf8";
import rmfr from "rmfr";
import { watchRoot } from "../src/watcher";
import http from "http";

declare global {
  namespace jest {
    interface Matchers<R> {
      toExist(): R;
    }
  }
}

/**
 * Hello world type tests, make sure the core configuration
 * and generation capabilities are working.
 *
 * This doesn't actually test that a server runs, or that you can
 * call APIs, -- just that configuration worked at all.
 */
describe("hello world configuration!", () => {
  let theConfig: Configuration = undefined;
  let rootContext: InternalContext;
  let root = "";
  let listening: http.Server;
  let callback;
  beforeAll(async () => {
    root = path.relative(process.cwd(), "./.tests/hello");
    // clean up
    await rmfr(root);
    // get the configuration and generate - let's do this just the once
    // and have a few tests that asser things happened
    const configuration = (theConfig = await loadConfiguration(root));
    rootContext = await buildInternalContext(configuration);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { decorateInternalContext } = require(path.join(
      process.cwd(),
      rootContext.configuration.embraceSQLRoot,
      "context"
    ));
    const server = await createServer(decorateInternalContext(rootContext));
    callback = server.callback();
    listening = server.listen(4567);
  });
  afterAll(async (done) => {
    listening.close(() => done());
  });
  expect.extend({
    toExist(fileName) {
      const fullPath = path.join(theConfig.embraceSQLRoot, fileName);
      const exists = fs.existsSync(fullPath);
      return exists
        ? { message: (): string => `${fullPath} exists`, pass: true }
        : { message: (): string => `${fullPath} does not exist`, pass: false };
    },
  });
  it("reads a config", async () => {
    expect(theConfig).toMatchSnapshot();
  });
  it("makes a default config for you", async () => {
    expect("embracesql.yaml").toExist();
  });
  it("makes a sqlite database for you", async () => {
    expect(theConfig.databases["default"].pathname).toExist();
  });
  it("makes a hello world sql for you", async () => {
    expect("default/hello.sql").toExist();
  });
  it("makes empty handlers for you", async () => {
    expect("default/before.ts").toExist();
    expect("default/hello.sql.before.ts").toExist();
    expect("default/hello.sql.after.ts").toExist();
    expect("default/after.ts").toExist();
    expect("default/hello.sql.afterError.ts").toExist();
  });
  it("exposes methods to run hello sql", async () => {
    expect(
      rootContext.databases["default"].SQLModules.hello.sql
    ).toMatchSnapshot();
  });
  it("generates an open api doc", async () => {
    expect("openapi.yaml").toExist();
    const content = await readFile(
      path.join(theConfig.embraceSQLRoot, "openapi.yaml")
    );
    expect(content).toMatchSnapshot();
  });
  it("generates a typed context object", async () => {
    expect("context.ts").toExist();
  });
  it("generates client library for you", async () => {
    expect("client/node/index.ts").toExist();
    expect("client/node-inprocess/index.ts").toExist();
    expect("client/browser/index.ts").toExist();
  });
  it("will run a query in context", async () => {
    const results = await rootContext.databases["default"].execute(
      rootContext.databases["default"].SQLModules["hello"]
    );
    expect(results).toMatchSnapshot();
  });
  it("will make a runnable server", async () => {
    const response = await request(callback).get("/default/hello");
    expect(response.text).toMatchSnapshot();
    // client
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { EmbraceSQL } = require(path.join(
      process.cwd(),
      rootContext.configuration.embraceSQLRoot,
      "client",
      "node"
    ));
    const client = EmbraceSQL("http://localhost:4567");
    expect(await client.databases.default.hello.sql()).toMatchSnapshot();
  });
  it("will make an embeddable engine", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { EmbraceSQL } = require(path.join(
      process.cwd(),
      rootContext.configuration.embraceSQLRoot,
      "client",
      "node-inprocess"
    ));
    const client = EmbraceSQL(rootContext);
    expect(await client.databases.default.hello.sql()).toMatchSnapshot();
  });
  it("will watch for changes and create a new context", async (done) => {
    const watcher = watchRoot(root);
    watcher.emitter.on("reload", async (newContext: InternalContext) => {
      // it's a new object
      expect(newContext).not.toBe(rootContext);
      // and it has the values we expect
      expect(newContext).toMatchSnapshot();
      await watcher.close();
      // and let Jest finish
      done();
    });
    // adding a new file should trigger the watcher
    // calling back to the event, which should tell jest we are all done
    await fs.outputFile(
      path.join(theConfig.embraceSQLRoot, "default", "yo.sql"),
      "SELECT 'yo'"
    );
  });
  it("will make migrations directories", async () => {
    expect("migrations/default").toExist();
  });
});
