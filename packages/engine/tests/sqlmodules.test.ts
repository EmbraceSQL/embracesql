import path from "path";
import fs from "fs-extra";
import { loadConfiguration } from "../src/configuration";
import { buildInternalContext, InternalContext } from "../src/internal-context";
import { migrate } from "../src/migrations";
import rmfr from "rmfr";

describe("sqlmodules provide handlers", () => {
  let rootContext: InternalContext;
  const root = path.relative(process.cwd(), "./.tests/sqlmodules");
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
  it("knows add.sql is not read only", async () => {
    expect(
      rootContext.databases["default"].modules.add.canModifyData
    ).toBeTruthy();
  });
  it("reads and writes things", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { EmbraceSQLEmbedded } = require(path.join(
      process.cwd(),
      rootContext.configuration.embraceSQLRoot
    ));
    const engine = await EmbraceSQLEmbedded();
    // initial values
    expect(await engine.databases.default.all()).toMatchSnapshot();
    // add a thing
    expect(
      await engine.databases.default.add({ id: 3, name: "automobiles" })
    ).toMatchSnapshot();
    // and read again
    expect(await engine.databases.default.all()).toMatchSnapshot();
  });
});
