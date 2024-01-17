// deno-lint-ignore-file require-await no-explicit-any
import { fixturesd, null_logger as logger } from "../utils/test-utils.ts"
import { _internals as _devenv_internals } from "../utils/devenv.ts"
import specimen0, { _internals } from "./internal.activate.ts"
import { assertEquals, assertRejects } from "deno/assert/mod.ts"
import * as mock from "deno/testing/mock.ts"
import { SemVer, Path, utils, semver } from "pkgx"

Deno.test("internal.activate.ts", async runner => {

  const specimen = (path: Path) => specimen0(path, { logger, powder: [] })

  const stub1 = mock.stub(_internals, "install", async () => {
    const installations = [{
      pkg: { project: "nodejs.org", version: new SemVer("20.1.2") }, path: new Path("/opt/nodejs.org/v20.1.2"),
    }]
    return { installations, pkgenv: [{ project: "nodejs.org", constraint: new semver.Range("^20") }] }
  })
  const stub2 = mock.stub(_internals, "construct_env", () => Promise.resolve({
    PATH: "/opt/nodejs.org/v20.1.2/bin",
    FOO: "BAR"
  }))
  const stub3 = mock.stub(_internals, "datadir", () => Path.mktemp())
  const stub4 = mock.stub(_devenv_internals, "find", pkg => utils.pkg.parse(pkg) as any)

  try {
    await runner.step("happy", async () => {
      await specimen(fixturesd)
    })

    await runner.step("no dir", async () => {
      await assertRejects(() => specimen(new Path("/a/b/c/pkgx")))
    })

    await runner.step("forbidden dirs", async () => {
      await assertRejects(() => specimen(Path.root))
      await assertRejects(() => specimen(Path.home()))
    })

    await runner.step("no devenv", async () => {
      await assertRejects(() => specimen(Path.root.join("usr")))
    })

    await runner.step("existing env matches", async () => {
      const stub = mock.stub(_internals, "getenv", key => {
        if (key == 'FOO' || key == 'PS1') {
          return 'BAR'
        } else {
          return Deno.env.get(key)
        }
      })
      try {
        await specimen(fixturesd)
      } finally {
        stub.restore()
      }
    })

  } finally {
    stub1.restore()
    stub2.restore()
    stub3.restore()
    stub4.restore()
  }

  await runner.step("coverage++", () => {
    _internals.datadir()
  })

  await runner.step("apply userenv", () => {
    const userenv = { PATH: "/foo/bar:$PATH" }
    const env = { PATH: "/baz:$PATH"}
    _internals.apply_userenv(env, userenv)
    assertEquals(env.PATH, "/foo/bar:/baz:$PATH")
  })
})
