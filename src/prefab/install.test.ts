// deno-lint-ignore-file no-explicit-any require-await
import { assert, assertEquals, assertFalse } from "deno/assert/mod.ts"
import { null_logger as logger  } from "../utils/test-utils.ts"
import specimen, { _internals } from "./install.ts"
import hydrate from "pkgx/plumbing/hydrate.ts"
import * as mock from "deno/testing/mock.ts"
import { Path, SemVer, semver } from "pkgx"

Deno.test("install.ts", () => {
  const gas = [
    { project: "bar.org", version: new SemVer("1.2.3") },
    { project: "foo.com", version: new SemVer("2.3.4") },
    { project: "baz.net", version: new SemVer("3.4.5") }
  ]

  const stub1 = mock.stub(_internals, "getproj", ({ project }: any) => ({
    companions: async () => {
      assertEquals(project, "bar.org")
      return [{project: "foo.com", constraint: new semver.Range("~2.1") }]
    }
  }) as any)
  const stub2 = mock.stub(_internals, "hydrate", async input => {
    return hydrate(input, async ({project}: any) => {
      switch (project) {
      case "foo.com":
        return [{
          project: "baz.net", constraint: new semver.Range("^3")
        }]
      case "bar.org":
        return []
      case "baz.net":
        return []
      default:
        throw new Error()
      }
    })
  })
  const stub3 = mock.stub(_internals, "resolve", async (wet, opts) => {
    assertFalse(opts!.update)
    const projects = new Set(wet.map(({project}) => project))
    assertEquals(projects, new Set(gas.map(({project}) => project)))
    return {
      pkgs: gas,
      pending: gas.slice(0, 2),
      installed: [{
        pkg: gas[2],
        path: Path.root
      }]
    }
  })
  let i = 0
  const set = new Set()
  const stub4 = mock.stub(_internals, "install", async pkg => {
    assertEquals(pkg, gas[i++])
    set.insert(pkg.project)
    return { pkg, path: Path.root }
  })

  const stub5 = mock.stub(_internals, "link", async ({pkg}: any) => {
    assert(set.delete(pkg.project))
  })

  try {
    const opts = { update: false, logger }
    specimen([{ project: "bar.org", constraint: new semver.Range("^1") }], opts)
  } finally {
    stub1.restore()
    stub2.restore()
    stub3.restore()
    stub4.restore()
    stub5.restore()
  }
})
