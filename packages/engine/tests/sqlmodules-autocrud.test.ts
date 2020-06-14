import path from "path";
import fs from "fs-extra";
import { loadConfiguration } from "../src/configuration";
import { buildInternalContext, InternalContext } from "../src/context";
import { migrate } from "../src/migrations";
import rmfr from "rmfr";
import { createServer } from "..";
import http from "http";
import { example } from "./examples/orders_items";

describe("sqlmodules provide autocrud", () => {
  let rootContext: InternalContext;
  const root = path.relative(process.cwd(), "./.tests/sqlmodules-autocrud");
  let engine;
  let nodeHttpClient;
  let listening: http.Server;
  beforeAll(async () => {
    // clean up
    await fs.ensureDir(root);
    await rmfr(root);
    await fs.copy(path.join(__dirname, "configs/sqlmodules-autocrud"), root);
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
  });
  afterAll(async (done) => {
    await engine.close();
    listening.close(() => done());
  });
  describe("works with single parameter set", async () => {
    const cycle = async (client) => {
      // make a single thing -- get a single key
      const newKey = await client.databases.default.autocrud.things.create({
        id: 100,
        name: "hi there",
      });
      expect(newKey).toMatchSnapshot();
      // all those rows
      expect(
        await client.databases.default.autocrud.things.read()
      ).toMatchSnapshot();
      // read with an 'array' -- of one...
      expect(
        await client.databases.default.autocrud.things.read(newKey)
      ).toMatchSnapshot();
      // update a single, built in readback
      expect(
        await client.databases.default.autocrud.things.update({
          ...newKey,
          name: "super",
        })
      ).toMatchSnapshot();
      // did it really stick update?
      expect(
        await client.databases.default.autocrud.things.read(newKey)
      ).toMatchSnapshot();
      // nuke it
      expect(
        await client.databases.default.autocrud.things.delete(newKey)
      ).toMatchSnapshot();
      // what's left?
      expect(
        await client.databases.default.autocrud.things.read()
      ).toMatchSnapshot();
      // what's left?
      expect(
        await client.databases.default.autocrud.things.read()
      ).toMatchObject([]);
    };
    it("in process", async () => {
      await cycle(engine);
    });
    it("over http", async () => {
      await cycle(nodeHttpClient);
    });
  });
  describe("works with arrays of parameters", async () => {
    const cycle = async (client) => {
      // make multiple things -- get multiple keys
      const newKey = await client.databases.default.autocrud.things.create(
        {
          id: 100,
          name: "hi there",
        },
        {
          id: 200,
          name: "hola",
        }
      );
      expect(newKey).toMatchSnapshot();
      // all those rows
      expect(
        await client.databases.default.autocrud.things.read()
      ).toMatchSnapshot();
      // read with an 'array' -- of one...
      expect(
        await client.databases.default.autocrud.things.read(newKey)
      ).toMatchSnapshot();
      // update  built in readback
      expect(
        await client.databases.default.autocrud.things.update(
          newKey.map((k) => ({ ...k, name: "super" }))
        )
      ).toMatchSnapshot();
      // did it really stick update?
      expect(
        await client.databases.default.autocrud.things.read(newKey)
      ).toMatchSnapshot();
      // nuke it
      expect(
        await client.databases.default.autocrud.things.delete(newKey)
      ).toMatchSnapshot();
      // what's left?
      expect(
        await client.databases.default.autocrud.things.read()
      ).toMatchSnapshot();
      // a few more new --
      await client.databases.default.autocrud.things.create(
        {
          id: 300,
          name: "fizz",
        },
        {
          id: 400,
          name: "buzz",
        }
      );
      // kill em all -- readback can be used to delete and
      // extra columns / parameters are ignored
      expect(
        await client.databases.default.autocrud.things.delete(
          await client.databases.default.autocrud.things.read()
        )
      ).toMatchSnapshot();
      // what's left?
      expect(
        await client.databases.default.autocrud.things.read()
      ).toMatchObject([]);
    };
    it("in process", async () => {
      await cycle(engine);
    });
    it("over http", async () => {
      await cycle(nodeHttpClient);
    });
  });
  describe("works like the documentation", async () => {
    it("in process", async () => {
      await example(engine);
    });
  });
  it("works like the documentation over http", async () => {});
});
