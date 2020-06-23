import path from "path";
import fs from "fs-extra";
import { loadConfiguration } from "../src/configuration";
import { buildInternalContext, InternalContext } from "../src/internal-context";
import { createServer } from "../src/server";
import rmfr from "rmfr";
import http from "http";

/**
 * The -- most secure scenario -- no query can run.
 */
describe("secure by default", () => {
  let rootContext: InternalContext;
  let listening: http.Server;
  let engine;
  let nodeHttpClient;
  beforeAll(async () => {
    const root = path.relative(process.cwd(), "./.tests/security");
    // clean up
    await fs.ensureDir(root);
    await rmfr(root);
    // get the configuration and generate - let's do this just the once for speed
    const configuration = await loadConfiguration(root);
    // set up
    await fs.copy(path.join(__dirname, "configs/security"), root);
    rootContext = await buildInternalContext(configuration);
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
  });
  afterAll(async (done) => {
    listening.close(() => done());
  });
  describe.each([
    ["client", engine],
    ["http", nodeHttpClient],
  ])("%s", (_, client) => {
    describe("secure by default", () => {
      it("will deny access with an SQL call", async () => {
        expect(
          client.databases.default.hello({ stuff: "nodey thing" })
        ).rejects.toThrowError("Unauthorized");
      });
      it("will deny access with an AutoCRUD call", async () => {
        expect(
          client.databases.default.autocrud.things.read()
        ).rejects.toThrowError("Unauthorized");
      });
    });
  });
});
