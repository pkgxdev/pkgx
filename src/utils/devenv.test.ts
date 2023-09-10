// deno-lint-ignore-file require-await
import { assert, assertEquals, assertRejects } from "deno/assert/mod.ts"
import specimen, { _internals } from "./devenv.ts"
import * as mock from "deno/testing/mock.ts"
import { fixturesd } from "./test-utils.ts"
import { Path, utils } from "tea"

Deno.test("devenv.ts", async runner => {

  const stub = mock.stub(_internals, "find", async pkg => utils.pkg.parse(pkg))

  try {
    await runner.step("supplementable fixtures", async test => {
      // each of the files in this list must have a zlib.net^1.2 dependency and a FOO=BAR env
      const keyfiles = [
        ["tea.yml"],
        ["deno.json/std/deno.json", "deno.land"],
        ["deno.json/arr/deno.json", "deno.land"],
        ["deno.jsonc", "deno.land"],
        ["package.json/std/package.json", "nodejs.org"],
        ["package.json/str/package.json", "nodejs.org"],
        ["package.json/arr/package.json", "nodejs.org"],
        ["cargo.toml", "rust-lang.org"],
        ["Gemfile", "ruby-lang.org"],
        ["pyproject.toml/std/pyproject.toml", "pip.pypa.io"],
        ["pyproject.toml/poetry/pyproject.toml", "python-poetry.org"],
        ["go.mod", "go.dev"],
        ["requirements.txt", "pip.pypa.io"],
        [".yarnrc", "classic.yarnpkg.com"],
        ["pixi.toml", "prefix.dev"],
        ["action.yml", "nodejs.org^16"]
      ]

      for (const [keyfile, dep] of keyfiles) {
        await test.step(`${keyfile}`, async () => {
          const file = fixturesd.join(keyfile).cp({ into: Path.mktemp() })
          const { env, pkgs } = await specimen(file.parent())
          assert(pkgs.find(pkg => utils.pkg.str(pkg) == "zlib.net^1.2"), "should dep zlib^1.2")
          if (dep) {
            assert(pkgs.find(pkg => utils.pkg.str(pkg) == dep), `should dep ${dep}`)
          }

          switch (keyfile) {
          case 'package.json/str/package.json':
          case 'package.json/arr/package.json':
          case 'deno.json/arr/deno.json':
            break  // testing the short form for deps with these files
          default:
            assertEquals(env.FOO, "BAR")
          }
        })
      }
    })

    await runner.step("fixed fixtures", async test => {
      const keyfiles = [
        [".node-version", "nodejs.org@16.16.0"],
        ["python-version/std/.python-version", "python.org~3.10"],
        ["python-version/commented/.python-version", "python.org~3.11"],
        [".ruby-version", "ruby-lang.org@3.2.1"]
      ]

      for (const [keyfile, dep] of keyfiles) {
        await test.step(keyfile, async () => {
          const file = fixturesd.join(keyfile).cp({ into: Path.mktemp() })
          const { env, pkgs } = await specimen(file.parent())

          assertEquals(Object.keys(env).length, 0)
          assertEquals(utils.pkg.str(pkgs[0]), dep)
        })
      }
    })

    await runner.step("broken .python-version", async () => {
      const file = fixturesd.join("python-version/broken/.python-version").cp({ into: Path.mktemp() })
      const { pkgs } = await specimen(file.parent())
      assertEquals(pkgs.length, 0)  //NOTE this seems like dumb behavior
    })

    await runner.step("vcs", async test => {
      const vcss = [
        ["git", "git-scm.org"],
        ["hg", "mercurial-scm.org"],
        ["svn", "apache.org/subversion"]
      ]

      for (const [vcs, dep] of vcss) {
        await test.step(vcs, async () => {
          const d = Path.mktemp().join(`.${vcs}`).mkdir()
          const { env, pkgs } = await specimen(d.parent())
          assertEquals(Object.keys(env).length, 0)
          assertEquals(utils.pkg.str(pkgs[0]), dep)
        })
      }
    })

    await runner.step("no dir error", async () => {
      await assertRejects(() => specimen(new Path("/a/b/c/tea")))
    })

    await runner.step("not error if no yaml fm", async () => {
      const f = Path.mktemp().join('pyproject.toml').touch()
      await specimen(f.parent())

      f.rm().write({ text: "#---\n#---" })
      await specimen(f.parent())

      // we don’t support invalid json just like npm won’t
      f.parent().join("package.json").touch()
      await assertRejects(() => specimen(f.parent()))

      f.parent().join("package.json").rm().write({text: "{}"})
      await specimen(f.parent())
    })

    await runner.step("skips invalid deps node", async () => {
      const f = Path.mktemp().join("package.json").rm().write({text: '{"tea": {"dependencies": true}}'})
      const { pkgs } = await specimen(f.parent())
      assertEquals(pkgs.length, 1)
      assertEquals(pkgs[0].project, "nodejs.org")
    })

  } finally {
    stub.restore()
  }
})
