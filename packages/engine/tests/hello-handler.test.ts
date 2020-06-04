import path from "path";
import fs from "fs-extra";
import { loadConfiguration } from "../src/configuration";
import { buildInternalContext, InternalContext } from "../src/context";
import { createServer } from "../src/server";
import request from "supertest";
import rmfr from "rmfr";
import http from "http";

/**
 * Let's test handlers. These rely on generated code, so the internal context
 * needs to be decorated with the handlers.
 *
 * The setup in beforeAll is a rough simulation of using the system there is a context
 * and directory, with some custom code inserted into handlers.
 */
describe("hello world with a handler", () => {
  let rootContext: InternalContext;
  let listening: http.Server;
  let callback;
  beforeAll(async () => {
    const root = path.relative(process.cwd(), "./.tests/hello-handler");
    // clean up
    await fs.ensureDir(root);
    await rmfr(root);
    // get the configuration and generate - let's do this just the once for speed
    const configuration = await loadConfiguration(root);
    // set up
    await fs.copy(path.join(__dirname, "configs/hello-handler"), root);
    rootContext = await buildInternalContext(configuration);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { decorateInternalContext } = require(path.join(
      process.cwd(),
      rootContext.configuration.embraceSQLRoot,
      "context"
    ));
    const server = await createServer(decorateInternalContext(rootContext));
    callback = server.callback();
    listening = server.listen(45679);
    // non logging
    rootContext.configuration.logLevels = [];
  });
  afterAll(async (done) => {
    listening.close(() => done());
  });
  it("will honor handlers over an HTTP call - GET", async () => {
    const response = await request(callback).get(
      "/default/hello?stuff=whirled"
    );
    expect(response.text).toMatchSnapshot();
  });
  it("will honor handlers over an HTTP call - GET - nested", async () => {
    const response = await request(callback).get(
      "/default/nested/echo?stuff=zzzooom"
    );
    expect(response.text).toMatchSnapshot();
  });
  it("will honor handlers over an HTTP call - POST", async () => {
    const postResponse = await request(callback)
      .post("/default/hello")
      .send({ stuff: "amazing" });
    expect(postResponse.text).toMatchSnapshot();
  });
  it("will honor handlers over an HTTP call - POST", async () => {
    const postResponse = await request(callback)
      .post("/default/nested/echo")
      .send({ stuff: "marklar" });
    expect(postResponse.text).toMatchSnapshot();
  });
  it("will honor handlers with a client call", async () => {
    // client
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { EmbraceSQL } = require(path.join(
      process.cwd(),
      rootContext.configuration.embraceSQLRoot,
      "client",
      "node"
    ));
    const client = EmbraceSQL("http://localhost:45679");
    expect(
      await client.databases.default.hello.sql({ stuff: "nodey thing" })
    ).toMatchSnapshot();
  });
  it("will honor handlers with an embeddable engine", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { EmbraceSQL } = require(path.join(
      process.cwd(),
      rootContext.configuration.embraceSQLRoot,
      "client",
      "node-inprocess"
    ));
    const client = EmbraceSQL(rootContext);
    expect(
      await client.databases.default.hello.sql({ stuff: "hole" })
    ).toMatchSnapshot();
  });
  it("will return errors via HTTP - GET", async () => {
    const response = await request(callback).get("/default/hello?stuff=error");
    expect({ status: response.status, text: response.text }).toMatchSnapshot();
  });
  it("will return errors via HTTP - POST", async () => {
    const response = await request(callback)
      .post("/default/hello")
      .send({ stuff: "error" });
    expect({ status: response.status, text: response.text }).toMatchSnapshot();
  });
  it("will throw errors back out to the client", async () => {
    // client
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { EmbraceSQL } = require(path.join(
      process.cwd(),
      rootContext.configuration.embraceSQLRoot,
      "client",
      "node"
    ));
    const client = EmbraceSQL("http://localhost:45679");
    // simulated error throw
    expect(
      client.databases.default.hello.sql({ stuff: "error" })
    ).rejects.toMatchSnapshot();
  });
  it("will throw errors back out to the client - nested", async () => {
    // client
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { EmbraceSQL } = require(path.join(
      process.cwd(),
      rootContext.configuration.embraceSQLRoot,
      "client",
      "node"
    ));
    const client = EmbraceSQL("http://localhost:45679");
    // simulated error throw
    expect(
      client.databases.default.nested.echo.sql({ stuff: "error" })
    ).rejects.toMatchSnapshot();
  });
});
