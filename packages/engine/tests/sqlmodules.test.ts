import path from "path";
import fs from "fs-extra";
import { loadConfiguration } from "../src/configuration";
import { buildInternalContext, InternalContext } from "../src/context";
import { migrate } from "../src/migrations";
import rmfr from "rmfr";

describe("hello world of migrations", () => {
  let rootContext: InternalContext;
  const root = path.relative(process.cwd(), "./.tests/sqlmodule");
  beforeAll(async () => {
    // clean up
    await fs.ensureDir(root);
    await rmfr(root);
    await fs.copy(path.join(__dirname, "configs/sqlmodules"), root);
    // get the configuration and generate - let's do this just the once
    // and have a few tests that asser things happened
    const configuration = await loadConfiguration(root);
    rootContext = await buildInternalContext(configuration);
    await migrate(rootContext);
    // reset and go
    await rootContext.close();
    rootContext = await buildInternalContext(configuration);
  });
  it("reads and writes things", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { EmbraceSQL } = require(path.join(
      process.cwd(),
      rootContext.configuration.embraceSQLRoot,
      "client",
      "node-inprocess"
    ));
    const client = EmbraceSQL(rootContext);
    // initial values
    expect(await client.databases.default.all.sql()).toMatchSnapshot();
    // add a thing
    await client.databases.default.add.sql({ id: 3, name: "automobiiles" });
    expect(await client.databases.default.all.sql()).toMatchSnapshot();
  });
});
