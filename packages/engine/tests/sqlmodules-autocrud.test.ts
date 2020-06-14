import path from "path";
import fs from "fs-extra";
import { loadConfiguration } from "../src/configuration";
import { buildInternalContext, InternalContext } from "../src/context";
import { migrate } from "../src/migrations";
import rmfr from "rmfr";
import { createServer } from "..";
import http from "http";

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
  it("works like the documentation", async () => {
    const client = engine;
    // little shortcut to type less...
    const db = client.databases.default.autocrud;

    // make a single item -- comes back with an object
    const item_key = await db.items.create({ description: "Paper" });

    // and array valued, make a few records in one shot...
    const more_item_keys = await db.items.create(
      { description: "Can" },
      { description: "Loaf" }
    );

    // no need to pass in the key, it is an auto increment, but you
    // sure will need it to put in order items, so let's capture the created key
    // whih EmbraceSQL thought of for you
    const order_key = await db.orders.create({ name: "Sample" });

    // now join items and orders with one of each
    // again notice we don't need to mention the autoincrement
    await db.order_items.create(
      [item_key, ...more_item_keys].map((item_key) => ({
        order_id: order_key.order_id,
        item_id: item_key.item_id,
        quantity: 1,
      }))
    );

    // You can use that created key to 'read back' a record, kinda handy
    // oh -- and it pulls back the whole associated referential graph
    // your reward for embracing sql and referential integrity is not needing
    // to query to get child records like order_items or lookup data like items
    const my_order = await db.orders.read(order_key);

    // notice three tables are joined automatically and you can get the description
    // EmbraceSQL inside created a query batch to pull in all this data
    // -- in one trip to the database, so it's not a chatterbox like ORMs
    /*
    console.log(
      my_order.name,
      my_order.order_items,
      my_order.order_items[0].description
    );
    */

    // And sometimes you really do need the whole table
    // This is even simpler, just don't pass any parameters!
    const all_orders = await db.orders.read();
    console.log(all_orders);

    // hmm -- I really want two of that... let's update, passing in all the order items
    // and using nice object spread with one property of overwrite
    await db.order_items.update({
      ...my_order.order_items,
      quantity: 2,
    });

    // nope -- I don't want it at all
    // delete the whole thing down the referentia graph
    await db.orders.delete(order_key);

    // but the items aren't deleted -- they are lookup data!
    // EmbraceSQL is smart enough to only delete children
    console.log(await db.items.read());

    // clean up the items
    await db.items.delete(await db.items.read());
    console.log(await db.items.read());
  });
  it("works like the documentation over http", async () => {});
});
