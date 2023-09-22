// deno-lint-ignore-file require-await
import { semver, SemVer, Path, Installation, utils } from "pkgx"
import { null_logger as logger } from "../utils/test-utils.ts"
import specimen0, { _internals } from "./internal.use.ts"
import * as mock from "deno/testing/mock.ts"

Deno.test("internal.use.ts", async runner => {

  const specimen = (pkgstr: string) => {
    const pkgs = pkgstr.split(' ')
    const plus = pkgs.compact(x => x.startsWith('+') ? utils.pkg.parse(x.slice(1)) : undefined)
    const minus = pkgs.compact(x => x.startsWith('-') ? utils.pkg.parse(x.slice(1)) : undefined)
    const active = pkgs.compact(x => x.startsWith('.') ? utils.pkg.parse(x.slice(1)) : undefined)
    return specimen0({ pkgs: {plus, minus, active }, logger, update: false })
  }

  const stub1 = mock.stub(_internals, "install", async pkgs => {
    let installations: Installation[]
    if (pkgs[0].project != 'bytereef.org/mpdecimal') {
      installations = [{
        pkg: { project: "nodejs.org", version: new SemVer("20.1.2") }, path: new Path("/opt/nodejs.org/v20.1.2"),
      }]
    } else {
      installations = [{
        pkg: { project: "bytereef.org/mpdecimal", version: new SemVer("20.1.2") }, path: new Path("/opt/bytereef.org/mpdecimal/v20.1.2"),
      }]
    }
    return { installations, pkgenv: [{project: 'nodejs.org', constraint: new semver.Range('^20')}] }
  })
  const stub2 = mock.stub(_internals, "construct_env", () => Promise.resolve({
    PATH: "/opt/nodejs.org/v20.1.2/bin",
    FOO: "BAR"
  }))

  try {
    await runner.step("primary functionality", async () => {
      await specimen("+node")
    })

    await runner.step("no bins", async () => {
      await specimen("+bytereef.org/mpdecimal")
    })

    await runner.step("minus/active", async () => {
      await specimen("+bytereef.org/mpdecimal -foo .foo")
    })

    await runner.step("empty", async () => {
      await specimen("")
    })

    await runner.step("existing env matches", async () => {
      const stub4 = mock.stub(_internals, "getenv", key => {
        if (key == 'FOO' || key == 'PS1') {
          return 'BAR'
        } else {
          return Deno.env.get(key)
        }
      })
      try {
        await specimen("+node")
      } finally {
        stub4.restore()
      }
    })

  } finally {
    stub1.restore()
    stub2.restore()
  }
})
