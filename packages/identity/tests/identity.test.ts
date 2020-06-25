import { validate, FileCache, parseBearerToken } from "../index";
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
    expect(validate("")).rejects.toThrowError("JWT must be a string");
  });

  it("will not validate garbage", async () => {
    expect(
      validate("A44248AD-B222-4C07-997C-F74CA3B6EE1A")
    ).rejects.toThrowError("JWTs must have three components");
  });

  describe.each(tokens)("%s", (tokenname) => {
    const token = fs.readFileSync(tokenname, "utf8");
    const checkName = path.basename(tokenname);
    describe("uncached", () => {
      /**
       * This has nock. Google keys will rotate over time - on purpose -- for securitai.
       *
       * So - nock is recording the http traffic to get Googly keys.
       *
       * And hey -- keys expire -- so we're going to affix the date.
       */
      it("validates", async () => {
        const { nockDone } = await nockBack(
          `${checkName}.json`,
          nockBackConfig
        );
        const validToken = await validate(token, {
          now: new Date("2020/06/22"),
        });
        expect(validToken.email).toEqual(checkName);
        nockDone();
      });
      it("blows up on gibberish", async () => {
        expect(validate(token.slice(10))).rejects.toThrow();
      });
      it("parses as a header", () => {
        expect(parseBearerToken({ Authorization: `Bearer ${token}` })).toMatch(
          token
        );
        expect(parseBearerToken({ authorization: `bearer ${token}` })).toMatch(
          token
        );
      });
    });

    // in the cached case, we'll pre load keys to make sure they are cached
    describe("cached", () => {
      const cacheIn = path.join(__dirname, ".cache");
      beforeAll(async () => {
        // a quick validate will force the cache, we'll use nock too so we can freeze the
        //key
        await fs.remove(cacheIn);
        const { nockDone } = await nockBack(
          `${checkName}.cached.json`,
          nockBackConfig
        );
        await validate(token, {
          cache: FileCache(cacheIn),
          now: new Date("2020/06/22"),
        });
        nockDone();
      });
      it("validates", async () => {
        const { nockDone } = await nockBack(
          `${checkName}.json`,
          nockBackConfig
        );
        const validToken = await validate(token, {
          cache: FileCache(cacheIn),
          now: new Date("2020/06/22"),
        });
        expect(validToken.email).toEqual(checkName);
        nockDone();
      });
      it("blows up on far future expiration", async () => {
        expect(
          validate(token, {
            cache: FileCache(cacheIn),
            now: new Date("2100/01/01"),
          })
        ).rejects.toThrowError('"exp" claim timestamp check failed');
      });
    });
  });
});
