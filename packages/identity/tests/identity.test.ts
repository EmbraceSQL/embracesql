import { validate } from "../src/index";
import nock from "nock";
import path from "path";
import fs from "fs-extra";

// testing with nock
const nockBackConfig = {
  recorder: {
    enable_reqheaders_recording: false,
  },
};
const nockBack = nock.back;
nockBack.setMode("record");
nockBack.fixtures = path.join(__dirname, "__nock-fixtures__");

describe("@embracesql/identity", () => {
  const tokens = fs
    .readdirSync(path.join(__dirname, "tokens"))
    .map((name) => path.resolve(__dirname, "tokens", name));

  it("will not validate a blank token", async () => {
    expect(validate("")).rejects.toThrow();
  });

  it("will not validate garbage", async () => {
    expect(validate("A44248AD-B222-4C07-997C-F74CA3B6EE1A")).rejects.toThrow();
  });

  describe.each(tokens)("%s", (tokenname) => {
    const token = fs.readFileSync(tokenname, "utf8");
    /**
     * This has nock. Google keys will rotate over time - on purpose -- for securitai.
     *
     * So - nock is recording the http traffic to get Googly keys.
     *
     * And hey -- keys expire -- so we're going to affix the date.
     */
    it("validates", async () => {
      const checkName = path.basename(tokenname);
      const { nockDone } = await nockBack(`${checkName}.json`, nockBackConfig);
      const validToken = await validate(token, { now: new Date("2020/06/22") });
      expect(validToken.email).toEqual(checkName);
      nockDone();
    });
    it("blows up on gibberish", async () => {
      expect(validate(token.slice(10))).rejects.toThrow();
    });
    it("blows up on far future expiration", async () => {
      expect(
        validate(token, { now: new Date("2100/01/01") })
      ).rejects.toThrow();
    });
  });
});
