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
  const root = path.relative(process.cwd(), "./.tests/security");
  let rootContext: InternalContext;
  let listening: http.Server;
  let engine;
  let nodeHttpClient;
  const clients = {};
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
    listening = server.listen(5678);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { EmbraceSQL } = require(path.join(
      process.cwd(),
      rootContext.configuration.embraceSQLRoot,
      "node"
    ));
    nodeHttpClient = EmbraceSQL("http://localhost:5678");
    clients["engine"] = engine;
    clients["http"] = nodeHttpClient;
  });
  afterAll(async (done) => {
    listening.close(() => done());
  });
  it("has clients", () => {
    expect(engine).toBeTruthy();
    expect(nodeHttpClient).toBeTruthy();
  });
  describe.each([["engine"], ["http"]])("%s", (clientName) => {
    describe("secure by default", () => {
      it("will deny access with an SQL call", async () => {
        const client = clients[clientName];
        expect(
          client.databases.default.hello({ stuff: "nodey thing" })
        ).rejects.toThrowError("Unauthorized");
      });
      it("will deny access with an AutoCRUD call", async () => {
        const client = clients[clientName];
        expect(
          client.databases.default.autocrud.things.read()
        ).rejects.toThrowError("Unauthorized");
      });
    });
  });
});
