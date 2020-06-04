import path from "path";
import fs from "fs-extra";
import { loadConfiguration } from "../src/configuration";
import { buildInternalContext, InternalContext } from "../src/context";
import { migrate } from "../src/migrations";
import rmfr from "rmfr";

describe("hello world of migrations", () => {
  let rootContext: InternalContext;
  let root: string;
  beforeAll(async () => {
    root = path.relative(process.cwd(), "./.tests/hello-migrations");
    // clean up
    await fs.ensureDir(root);
    await rmfr(root);
  });
  it("will migrate", async () => {
    // get the configuration and generate - let's do this just the once
    // and have a few tests that asser things happened
    const configuration = await loadConfiguration(root);
    // set up
    await fs.copy(path.join(__dirname, "configs/hello-migrations"), root);
    console.warn(
      "The upcoming warning that strings does not exist is expected -- cause it is true! -- not created just yet"
    );
    rootContext = await buildInternalContext(configuration);
    await migrate(rootContext);
    // need a fresh context
    await rootContext.close();
    rootContext = await buildInternalContext(configuration);
    const results = await rootContext.databases["default"].execute(
      rootContext.databases["default"].SQLModules["hello"]
    );
    expect(results).toMatchSnapshot();
  });
});
