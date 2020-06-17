/* eslint-disable @typescript-eslint/no-namespace */
import path from "path";
import { loadConfiguration } from "../src/configuration";
import { buildInternalContext, InternalContext } from "../src/internal-context";
import { createServer } from "../src/server";
import request from "supertest";
import rmfr from "rmfr";
import { watchRoot } from "../src/watcher";
import http from "http";
import fs from "fs-extra";
import { SQLModule } from "../src/shared-context";

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
  const root = path.relative(process.cwd(), "./.tests/hello");
  let rootContext: InternalContext;
  let listening: http.Server;
  let callback;
  beforeAll(async () => {
    try {
      // clean up
      await rmfr(root);
      // get the configuration and generate - let's do this just the once
      // and have a few tests that asser things happened
      const configuration = await loadConfiguration(root);
      rootContext = await buildInternalContext(configuration);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { EmbraceSQLEmbedded } = require(path.join(
        process.cwd(),
        rootContext.configuration.embraceSQLRoot
      ));
      const engine = await EmbraceSQLEmbedded();
      const server = await createServer(engine);
      callback = server.callback();
      listening = server.listen(4567);
    } catch (e) {
      console.error(e);
    }
  });
  afterAll(async (done) => {
    listening.close(() => done());
  });
  expect.extend({
    toExist(fileName) {
      const fullPath = path.join(
        rootContext.configuration.embraceSQLRoot,
        fileName
      );
      const exists = fs.existsSync(fullPath);
      return exists
        ? { message: (): string => `${fullPath} exists`, pass: true }
        : { message: (): string => `${fullPath} does not exist`, pass: false };
    },
  });
  it("reads a config", async () => {
    expect(rootContext.configuration).toMatchSnapshot();
  });
  it("makes a default config for you", async () => {
    expect("embracesql.yaml").toExist();
  });
  it("makes a sqlite database for you", async () => {
    expect("embracesql.db").toExist();
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
  it("knows hello sql is read only", async () => {
    expect(
      rootContext.databases["default"].modules.hello.canModifyData
    ).toBeFalsy();
  });
  it("exposes methods to run hello sql", async () => {
    expect(
      (rootContext.databases["default"].modules.hello as SQLModule).sql
    ).toMatchSnapshot();
  });
  it("generates an open api doc", async () => {
    expect("openapi.yaml").toExist();
    const content = await fs.readFile(
      path.join(rootContext.configuration.embraceSQLRoot, "openapi.yaml"),
      "utf8"
    );
    expect(content).toMatchSnapshot();
  });
  it("generates a typed context object", async () => {
    expect("context.ts").toExist();
  });
  it("generates client library for you", async () => {
    expect("node.ts").toExist();
    expect("browser.ts").toExist();
  });
  it("will run a query in context", async () => {
    const results = await rootContext.databases["default"].execute(
      (rootContext.databases["default"].modules["hello"] as SQLModule).sql
    );
    expect(results).toMatchSnapshot();
  });
  it("will make a runnable server", async () => {
    const response = await request(callback).get("/default/hello");
    expect(response.text).toMatchSnapshot();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { EmbraceSQL } = require(path.join(
      process.cwd(),
      rootContext.configuration.embraceSQLRoot,
      "node"
    ));
    const client = EmbraceSQL("http://localhost:4567");
    expect(await client.databases.default.hello()).toMatchSnapshot();
  });
  it("will make an embeddable engine", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { EmbraceSQLEmbedded } = require(path.join(
      process.cwd(),
      rootContext.configuration.embraceSQLRoot
    ));
    const engine = await EmbraceSQLEmbedded();
    expect(await engine.databases.default.hello()).toMatchSnapshot();
  });
  it("will watch for changes and create a new context", async (done) => {
    const watcher = watchRoot(rootContext);
    watcher.emitter.on(
      "reload",
      async (oldContext: InternalContext, newContext: InternalContext) => {
        await oldContext.close();
        // it's a new object
        expect(newContext).not.toBe(rootContext);
        // and it has the values we expect
        expect(newContext).toMatchSnapshot();
        await watcher.close();
        // and let Jest finish
        done();
      }
    );
    // adding a new file should trigger the watcher
    // calling back to the event, which should tell jest we are all done
    setTimeout(async () => {
      await fs.outputFile(
        path.join(
          rootContext.configuration.embraceSQLRoot,
          "default",
          "yo.sql"
        ),
        "SELECT 'yo'"
      );
    }, 1000);
  });
  it("will make migrations directories", async () => {
    expect("migrations/default").toExist();
  });
});
