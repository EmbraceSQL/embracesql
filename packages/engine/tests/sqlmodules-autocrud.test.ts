import path from "path";
import fs from "fs-extra";
import { loadConfiguration } from "../src/configuration";
import { buildInternalContext, InternalContext } from "../src/context";
import { migrate } from "../src/migrations";
import rmfr from "rmfr";

describe("sqlmodules provide autocrud", () => {
  let rootContext: InternalContext;
  const root = path.relative(process.cwd(), "./.tests/sqlmodules-autocrud");
  let engine;
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
  });
  afterAll(async () => {
    engine.close();
  });
  it("makes use of AutoCrud", async () => {
    expect(engine.databases.default.autocrud).toBeTruthy();
    expect(engine.databases.default.autocrud.things).toBeTruthy();
    expect(engine.databases.default.autocrud.things.create).toBeInstanceOf(
      Function
    );
    const newKey = await engine.databases.default.autocrud.things.create({
      id: 100,
      name: "hi there",
    });
    expect(newKey).toMatchSnapshot();
    // all those rows
    expect(
      await engine.databases.default.autocrud.things.read()
    ).toMatchSnapshot();
    // read with one set of parameters
    expect(
      await engine.databases.default.autocrud.things.read(newKey[0])
    ).toMatchSnapshot();
    // read with an 'array' -- of one...
    expect(
      await engine.databases.default.autocrud.things.read(newKey)
    ).toMatchSnapshot();
    // update a single, built in readback
    expect(
      await engine.databases.default.autocrud.things.update({
        ...newKey[0],
        name: "super",
      })
    ).toMatchSnapshot();
    // update with an array of one -- we'll make a clone
    const updateWith = newKey.map((k) => ({ ...k, name: "grand" }));
    expect(
      await engine.databases.default.autocrud.things.update(updateWith)
    ).toMatchSnapshot();
    // did it really stick update?
    expect(
      await engine.databases.default.autocrud.things.read(newKey)
    ).toMatchSnapshot();
    // nuke it
    expect(
      await engine.databases.default.autocrud.things.delete(newKey)
    ).toMatchSnapshot();
    // nuke a single
    expect(
      await engine.databases.default.autocrud.things.delete({ id: 1 })
    ).toMatchSnapshot();
    // what's left?
    expect(
      await engine.databases.default.autocrud.things.read()
    ).toMatchSnapshot();
    // kill em all
    expect(
      await engine.databases.default.autocrud.things.delete(
        await engine.databases.default.autocrud.things.read()
      )
    ).toMatchSnapshot();
    // what's left?
    expect(await engine.databases.default.autocrud.things.read()).toMatchObject(
      []
    );
  });
});
