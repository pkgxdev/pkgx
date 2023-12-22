import { null_logger as logger } from "../utils/test-utils.ts"
import { assertEquals } from "deno/assert/mod.ts"
import specimen, { _internals } from "./env.ts"
import * as mock from "deno/testing/mock.ts"
import { semver } from "pkgx"
import undent from "outdent"

Deno.test("env.ts", async () => {
  const pkg = { project: "pkg1", constraint: new semver.Range("^1") }

  const stub1 = mock.stub(_internals, "install", () => Promise.resolve({installations: [], pkgenv: []}))
  const stub2 = mock.stub(_internals, "construct_env", () => Promise.resolve({
    PATH: "/a", FOO: "bar baz"
  }))

  try {
    const rv = await specimen({ pkgs: [pkg], update: false, logger })
    assertEquals(rv, undent`
      PATH=/a
      FOO="bar baz"
      `)
  } finally {
    stub1.restore()
    stub2.restore()
  }
});
