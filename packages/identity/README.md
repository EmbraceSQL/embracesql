# `@embracesql/identity`

Decodes and validates OpenID Connect tokens, returning an object.

Performs OpenID Connect discovery and key caching.

## Usage

```
import identity from "@embracesql/identity";

// assumes top level async, will create the directory as needed
const validIdToken = await identity.validate("<raw token>");

```
