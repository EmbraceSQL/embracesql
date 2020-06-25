import { validate, FileCache, jwtIdentity } from "../index";
import nock from "nock";
import path from "path";
import fs from "fs-extra";
import Koa from "koa";
import request from "supertest";

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
    .readdirSync(path.join(__dirname, "tokens", "jwt"))
    .map((name) => path.resolve(__dirname, "tokens", "jwt", name));

  it("will not validate a blank token", async () => {
    expect(validate("")).rejects.toThrowError("JWT must be a string");
  });

  it("will not validate garbage", async () => {
    expect(
      validate("A44248AD-B222-4C07-997C-F74CA3B6EE1A")
    ).rejects.toThrowError("JWTs must have three components");
  });

  // add in additional tokens for different providers as needed
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
    /**
     * Middleware testing.
     */
    describe("koa", () => {
      const cacheIn = path.join(__dirname, "tokens", "jwt");
      const app = new Koa();
      app.use(jwtIdentity({ cache: FileCache(cacheIn) }));
      app.use((ctx) => {
        ctx.body = ctx.state?.token?.email;
      });

      it("does nothing if there is no token", (done) => {
        request(app.listen()).get("/").expect(204).expect(" Error").end(done);
      });
      it("should 401 on a malformed token", (done) => {
        request(app.listen())
          .get("/")
          .set("Authorization", "wrong")
          .expect(401)
          .expect(
            'Bad Authorization header format. Format is "Authorization: Bearer <token>"'
          )
          .end(done);
      });
      it("should 200 on a valid token", (done) => {
        request(app.listen())
          .get("/")
          .set("Authorization", `Bearer: ${token}`)
          .expect(200)
          .expect(checkName)
          .end(done);
      });
    });
  });
});
