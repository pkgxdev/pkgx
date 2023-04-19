import { createTestHarness } from "./testUtils.ts"
import { assert, assertEquals } from "deno/testing/asserts.ts"
import { flatmap } from "utils"

const fixturesDir = new URL(import.meta.url).path().parent().parent().join('fixtures')

Deno.test("dev env interactions with HOME", { sanitizeResources: false, sanitizeOps: false }, async test => {
  const tests = [
    { home: undefined, expectedSrcroot: "first" },
    { home: "first", expectedSrcroot: "first/second" },
    { home: "first/second", expectedSrcroot: "first/second/tea" },
    { home: "first/second/tea", expectedSrcroot: "first/second/tea" },
  ]

  for (const {home, expectedSrcroot} of tests) {
    await test.step(`home is ${home ?? 'undefined'}`, async () => {
      const dirs = ["first", "second", "tea"]
      const { run, tmpDir } = await createTestHarness({ dir: dirs.join("/") })

      // add a dev env file to each sub folder - HOME should signal where to stop
      let into = tmpDir
      for (const dir of dirs) {
        into = into.join(dir)
        fixturesDir.join("tea.yaml").cp({into})
      }

      // Set the HOME dir - this doesn't come from useConfig unfortunately
      const originalHome = Deno.env.get("HOME")
      if (home) {
        const homeDir = tmpDir.join(home).string
        Deno.env.set("HOME", homeDir)
      }

      try {
        const { stdout } = await run(["+tea.xyz/magic", "-Esk", "--chaste", "env"])

        const envVar = (key: string) => getEnvVar("/bin/zsh", stdout, key)
        const srcroot = envVar("SRCROOT")
        const expected = tmpDir.join(expectedSrcroot).string
        assertEquals(srcroot, expected, "should set virtual env SRCROOT")
      } finally {
        if (originalHome) {
          Deno.env.set("HOME", originalHome)
        }
      }
    })
  }
})

Deno.test("should enter dev env", { sanitizeResources: false, sanitizeOps: false }, async test => {
  // each of the files in this list must have a zlib.net^1.2 depedency and a FOO=BAR env
  const envFiles = ["tea.yaml", "deno.json", "deno.jsonc", "package.json", "cargo.toml",
                    "Gemfile", "pyproject.toml", "go.mod", "requirements.txt"]

  for (const shell of ["/bin/bash", "/bin/fish", "/bin/elvish"]) {
    for (const envFile of envFiles) {
      await test.step(`${shell}-${envFile}`, async () => {
        const {run, teaDir } = await createTestHarness()

        fixturesDir.join(envFile).cp({into: teaDir})

        const TEA_REWIND = JSON.stringify({revert: {VAL: "REVERTED"}, unset: ["BAZ"]})

        const config = { env: { SHELL: shell, TEA_REWIND } }
        const { stdout } = await run(["+tea.xyz/magic", "-Esk", "--chaste", "env"], config)

        const envVar = (key: string) => getEnvVar(shell, stdout, key)
        const isUnset = (key: string) => isEnvVarUnset(shell, stdout, key)

        assert(getTeaPackages(shell, stdout).includes("zlib.net^1.2"), "should include zlib dep")

        assertEquals(envVar("FOO"), "BAR", "should set virtual env var")
        assertEquals(envVar("VAL"), "REVERTED", "should revert previous env")
        assert(isUnset("BAZ"), "should unset previous env")
        assertEquals(envVar("SRCROOT"), teaDir.string, "should set virtual env SRCROOT")

        const rewind = getRewind(shell, stdout)
        assert(rewind != null, "rewind should be set")
        assert(rewind.unset.includes("FOO"), "should rewind FOO")
        assert(rewind.unset.includes("SRCROOT"), "should rewind SRCROOT")
      })
    }
  }
})

Deno.test("should leave dev env", { sanitizeResources: false, sanitizeOps: false }, async test => {
  for (const shell of ["/bin/bash", "/bin/fish", "/bin/elvish"]) {
    await test.step(shell, async () => {
      const {run } = await createTestHarness({ sync: false })

      const TEA_REWIND = JSON.stringify({revert: {VAL: "REVERTED"}, unset: ["BAZ"]})

      const config = { env: { SHELL: shell, TEA_REWIND } }
      const { stdout } = await run(["+tea.xyz/magic", "-Esk", "--chaste", "env"], config)

      const envVar = (key: string) => getEnvVar(shell, stdout, key)
      const isUnset = (key: string) => isEnvVarUnset(shell, stdout, key)

      assertEquals(envVar("VAL"), "REVERTED", "should revert VAL")
      assert(isUnset("BAZ"), "rewind should be unset")
      assert(isUnset("TEA_REWIND"), "rewind should be unset")
    })
  }
})

Deno.test("should provide packages in dev env", { sanitizeResources: false, sanitizeOps: false }, async test => {
  const SHELL = "/bin/zsh"

  const tests = [
    { file: ".node-version", pkg: "nodejs.org>=16.16<16.16.1" },
    { file: "action.yml", pkg: "nodejs.org^16" },
    { file: "README.md", pkg: "nodejs.org=16.16.0" }
  ]

  for (const {file, pkg} of tests) {
    await test.step(file, async () => {
      const {run, teaDir } = await createTestHarness()

      fixturesDir.join(file).cp({into: teaDir})
      const { stdout } = await run(["+tea.xyz/magic", "-Esk", "--chaste", "env"], { env: { SHELL } })

      assert(getTeaPackages(SHELL, stdout).includes(pkg), "should include nodejs dep")
    })
  }
})

Deno.test("tolerant .node-version parsing", { sanitizeResources: false, sanitizeOps: false }, async test => {
  const SHELL = "/bin/zsh"

  for (const [spec, interpretation] of [["v16", "^16"], ["v16.16", "~16.16"], ["v16.16.0", ">=16.16<16.16.1"]]) {
    await test.step(spec, async () => {
      const {run, teaDir } = await createTestHarness()
      teaDir.join(".node-version").write({ text: `\n\n\n${spec}\n` })

      const { stdout } = await run(["+tea.xyz/magic", "-Esk", "--chaste", "env"], { env: { SHELL } })

      const pkg = `nodejs.org${interpretation}`
      assert(getTeaPackages(SHELL, stdout).includes(pkg), "should include nodejs dep")
    })
  }
})

function getEnvVar(shell: string, lines: string[], key: string): string | null {
  const pattern = () => {
    switch (shell) {
      case "/bin/fish":
        return `^set -gx ${key} '(.*)';$`
      case "/bin/elvish":
        return `^set-env ${key} '(.*)'$`
      default:
        return `export ${key}='(.*)'$`
    }
  }

  for (const line of lines) {
    const m = new RegExp(pattern()).exec(line)
    if (m && m.length > 1) {
      return m[1]
    }
  }
  return null
}

function isEnvVarUnset(shell: string, lines: string[], key:string): boolean {
  const pattern = () => {
    switch (shell) {
      case "/bin/fish":
        return `^set -e ${key};$`
      case "/bin/elvish":
        return `^unset-env ${key}$`
      default:
        return `unset ${key}$`
    }
  }

  return lines.some(line => new RegExp(pattern()).test(line))
}

interface Rewind {
  revert: Record<string, string>
  unset: string[]
}

function getRewind (shell: string, lines: string[]): Rewind | null {
  const rewind = getEnvVar(shell, lines, "TEA_REWIND")
  return flatmap(rewind, JSON.parse)
}

function getTeaPackages(shell: string, lines: string[]): string[] {
  const teaPkgs = getEnvVar(shell, lines, "TEA_PKGS")
  return flatmap(teaPkgs, (s) => s.split(":")) ?? []
}
