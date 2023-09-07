import specimen, { _internals } from "./in-active-pkgenv.ts"
import * as mock from "deno/testing/mock.ts"
import { assert, assertFalse } from "deno/assert/mod.ts"
import { semver } from "tea"

Deno.test("in-active-pkgenv.ts", async () => {
  const env = {
    "TEA_PKGENV": "foo.com^2"
  }
  const stub = mock.stub(_internals, "getenv", () => env["TEA_PKGENV"])
  try {
    assert(await specimen({project: "foo.com", constraint: new semver.Range(('~2.1'))}))
    assertFalse(await specimen({project: "foo.com", constraint: new semver.Range(('^3'))}))
  } finally {
   stub.restore()
  }
})
