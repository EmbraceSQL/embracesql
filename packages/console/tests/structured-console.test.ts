import stdMocks from "std-mocks";
import { install, uninstall } from "../src/structured";

describe("structured console logging", () => {
  beforeAll(() => install());
  beforeEach(() => stdMocks.use());
  afterEach(() => stdMocks.restore());
  it("captures log", async () => {
    console.log("Hello World");
    expect(stdMocks.flush()).toMatchSnapshot();
  });
  it("captures debug", async () => {
    console.debug("Hello World");
    expect(stdMocks.flush()).toMatchSnapshot();
  });
  it("captures info", async () => {
    console.info("Hello World");
    expect(stdMocks.flush()).toMatchSnapshot();
  });
  it("captures warn", async () => {
    console.warn("Hello World");
    expect(stdMocks.flush()).toMatchSnapshot();
  });
  it("captures error", () => {
    console.error("Hello World");
    expect(stdMocks.flush()).toMatchSnapshot();
  });
  afterAll(() => uninstall());
});
