# `@embracesql/identity`

Decodes and validates OpenID Connect tokens, returning an object.

Performs OpenID Connect discovery and key caching.

## Usage

```
import {validate, FileCache} from "@embracesql/identity";

// assumes top level async, will create the directory as needed
const validIdToken = await validate("<raw token>", {cache: new FileCache(".keys")});

```
