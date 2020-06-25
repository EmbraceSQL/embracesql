import path from "path";
import fs from "fs-extra";
import { loadConfiguration } from "../src/configuration";
import { buildInternalContext, InternalContext } from "../src/internal-context";
import { createServer } from "../src/server";
import rmfr from "rmfr";
import http from "http";
import { migrate } from "../src/migrations";

/**
 * The -- most secure scenario -- no query can run.
 */
describe("security", () => {
  const tokens = fs
    .readdirSync(path.join(__dirname, "tokens", "jwt"))
    .map((name) => path.resolve(__dirname, "tokens", "jwt", name));
  const root = path.relative(process.cwd(), "./.tests/security");
  let rootContext: InternalContext;
  let listening: http.Server;
  let engine;
  let nodeHttpClient;
  const clients = {};
  const port = 45678;
  const originalLog = console.log;
  beforeAll(async () => {
    // clean up
    await fs.ensureDir(root);
    await rmfr(root);
    await fs.copy(path.join(__dirname, "configs/security"), root);
    // get the configuration and generate - let's do this just the once
    // and have a few tests that asser things happened
    rootContext = await buildInternalContext(await loadConfiguration(root));
    await migrate(rootContext);
    // reset and regenerate
    await rootContext.close();
    rootContext = await buildInternalContext(await loadConfiguration(root));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { EmbraceSQLEmbedded } = require(path.join(
      process.cwd(),
      rootContext.configuration.embraceSQLRoot
    ));
    engine = await EmbraceSQLEmbedded();
    const server = await createServer(engine);
    await new Promise((resolve) => {
      listening = server.listen(port, resolve);
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { EmbraceSQL } = require(path.join(
      process.cwd(),
      rootContext.configuration.embraceSQLRoot,
      "node"
    ));
    nodeHttpClient = EmbraceSQL(`http://localhost:${port}`);
    clients["engine"] = engine;
    clients["http"] = nodeHttpClient;
  });
  afterAll(async (done) => {
    listening.close(() => done());
  });
  beforeEach(() => {
    // reset to blank headers
    clients["engine"].setHeaders({});
    clients["http"].setHeaders({});
    // log is an assertion
    console.log = (...args) => {
      expect(args).toMatchSnapshot();
    };
  });
  afterEach(() => {
    console.log = originalLog;
  });
  it("has clients", () => {
    expect(engine).toBeTruthy();
    expect(nodeHttpClient).toBeTruthy();
  });
  describe.each([["engine"], ["http"]])("%s", (clientName) => {
    describe("secure by default", () => {
      it("will deny access with an SQL call", async () => {
        const client = clients[clientName];
        await expect(async () =>
          client.databases.default.hello({ stuff: "nodey thing" })
        ).rejects.toThrowError("Unauthorized");
      });
      it("will deny access with an AutoCRUD call", async () => {
        const client = clients[clientName];
        await expect(async () =>
          client.databases.default.autocrud.things.read()
        ).rejects.toThrowError("Unauthorized");
      });
    });
    describe.each(tokens)("with token %s", (tokenname) => {
      const token = fs.readFileSync(tokenname, "utf8");
      it("will allow access with an SQL call", async () => {
        const client = clients[clientName];
        client.setHeaders({ authorization: `bearer ${token}` });
        expect(await client.databases.default.hello()).toMatchSnapshot();
      });
    });
  });
});
