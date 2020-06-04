import init from "../src/init";
import embedded from "../src/embedded";
import migrate from "../src/migrate";
import path from "path";
import fs from "fs-extra";
import stdMocks from "std-mocks";

describe("CLI", () => {
  beforeEach(() => stdMocks.use());
  afterEach(() => stdMocks.restore());
  it("initializes", async () => {
    const command = await init.parseAsync(["node", "init"]);
    expect(command.args).toMatchSnapshot();
    expect(stdMocks.flush()).toMatchSnapshot();
  });
  it("generates an embedded client", async () => {
    const root = path.resolve(path.join(__dirname, "..", ".tests", "embedded"));
    const command = await embedded.parseAsync([
      "node",
      "embedded",
      root,
      "--nowatch",
    ]);
    // trick needed to wait out
    await Promise.all(command.parent?._actionResults || []);
    // check on the key files
    expect(
      await fs.readFile(path.join(root, "index.ts"), "utf8")
    ).toMatchSnapshot();
  });
  it("migrates", async () => {
    const root = path.resolve(path.join(__dirname, "..", ".tests", "migrate"));
    const command = await migrate.parseAsync(["node", "migrate", root]);
    // trick needed to wait out
    await Promise.all(command.parent?._actionResults || []);
    // and some files to exist
    expect(
      await fs.readFile(path.join(root, "openapi.yaml"), "utf8")
    ).toMatchSnapshot();
  });
});
