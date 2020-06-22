import { JWT, JWK } from "jose";
import { Issuer } from "openid-client";
import urlParse from "url-parse";
import fs from "fs-extra";
import path from "path";

/**
 * Original encoded string, pass this in from a header.
 */
export type JWTString = string;

/**
 * Keys need to live somewhere, this is a key cache.
 */
export interface JWKCache {
  /**
   * Get a key by kid -- key id.
   */
  get: (kid: string) => Promise<JWK.Key>;
  /**
   * And -- stash a key, echoing it back.
   */
  set: (kid: string, jwk: JWK.Key) => Promise<JWK.Key>;
}
/**
 * Decoded token header.
 */
export type JWTHeader = {
  /**
   * The key ID is the only part we're really worried about.
   */
  kid: string;
};
/**
 * Decoded token, this is your identity.
 *
 * This has open name value fields as an identity provider can provide
 * any properties they want.
 */
export type JWTPayload = {
  [index: string]: string | number;
  /**
   * Standard claim -- token issuer.
   */
  iss: string;
  /**
   * Standard claim -- issue in ticks.
   */
  iat?: number;
  /**
   * Standard claim -- expiration in ticks.
   */
  exp?: number;
};

/**
 * Issuers -- particularly Google, sometimes omit the full URL.
 */
const cleanIssuer = (jwt: JWTPayload): string => {
  const parsed = urlParse(jwt.iss);
  if (parsed.protocol === "") {
    return `https://${parsed.href}`;
  } else {
    return jwt.iss;
  }
};

/**
 * Just in memory -- useful for testing.
 */
export class MemoryCache implements JWKCache {
  buffer: Map<string, JWK.Key>;

  constructor() {
    this.buffer = new Map<string, JWK.Key>();
  }

  async get(kid: string): Promise<JWK.Key> {
    return this.buffer.get(kid);
  }

  async set(kid: string, jwk: JWK.Key): Promise<JWK.Key> {
    this.buffer.set(kid, jwk);
    return jwk;
  }
}

/**
 * And cache keys on disk with files
 */
export class FileCache implements JWKCache {
  root: string;
  constructor(root: string) {
    this.root = root;
  }

  buildPath(kid: string): string {
    return path.join(this.root, `${kid}.json`);
  }

  async get(kid: string): Promise<JWK.Key> {
    await fs.ensureDir(this.root);
    const at = this.buildPath(kid);
    const exists = await fs.pathExists(at);
    if (exists) {
      return JSON.parse(await fs.readFile(at, "utf8"));
    } else {
      return undefined;
    }
  }

  async set(kid: string, jwk: JWK.Key): Promise<JWK.Key> {
    await fs.ensureDir(this.root);
    const at = this.buildPath(kid);
    await fs.writeFile(at, JSON.stringify(jwk), "utf8");
    return jwk;
  }
}

/**
 * Options used in token validation.
 */
export type validateOptions = {
  /**
   * Cache keys need to live somewhere.
   * If you don't specify this -- there is no cache.
   */
  cache?: JWKCache;
  /**
   * The date used to evaluate, so you can pretend it is
   * the future or the past.
   */
  now?: Date;
  /**
   * It's pretty normal to allow a perma-login, so you can totally
   * ignore token expiration.
   *
   * Note that you will still need to have the key from when the token
   * was created cached.
   */
  ignoreExp?: boolean;
};

/**
 * Validate a JWT Identity token, returning the useable token payload or throwing
 * an exception if no token is available.
 */
export const validate = async (
  idToken: JWTString,
  options?: validateOptions
): Promise<JWTPayload> => {
  // add on some defaults
  const optionsAfterDefaults = {
    cache: new MemoryCache(),
    now: new Date(),
    ignoreExp: false,
    ...options,
  };
  // we'll need to see into the token, and this can throw an exception
  const decoded = JWT.decode(idToken, { complete: true });
  const getTheKey = async (): Promise<JWK.Key> => {
    // hopefully, the JWK we need is already cached, and it can be easily fetched
    const fromCache = await optionsAfterDefaults.cache.get(
      (decoded.header as JWTHeader).kid
    );
    if (fromCache) return fromCache;
    // but if not, go out to OIDC discovery
    const issuer = await Issuer.discover(
      cleanIssuer(decoded.payload as JWTPayload)
    );
    for (const jwk of (await issuer.keystore(true)).all()) {
      await optionsAfterDefaults.cache.set(jwk.kid, jwk);
      // found it!
      if (jwk.kid === (decoded.header as JWTHeader).kid) return jwk;
    }
  };

  const validateWith = await getTheKey();
  if (validateWith) {
    //let this throw on a fail
    JWT.verify(idToken, validateWith, optionsAfterDefaults);
    return decoded.payload as JWTPayload;
  } else {
    // and the failure of last resort
    throw new Error("No key could be found to validate this token");
  }
};
