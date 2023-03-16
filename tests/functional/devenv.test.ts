import { createTestHarness } from "./testUtils.ts";
import { assert, assertEquals } from "https://deno.land/std@0.176.0/testing/asserts.ts"
import { flatmap } from "../../src/utils/safe-utils.ts";

Deno.test("should enter dev env", { sanitizeResources: false, sanitizeOps: false }, async test => {
  for (const shell of ["bash", "fish", "elvish"]) {
    await test.step(shell, async () => {
      const {run, teaDir, getPrintedLines } = await createTestHarness({ sync: false })

      const envVar = (key: string) => getEnvVar(shell, getPrintedLines(), key)
      const isUnset = (key: string) => isEnvVarUnset(shell, getPrintedLines(), key)

      Deno.writeTextFileSync(teaDir.join("tea.yml").string, "env:\n  FOO: BAR\n")

      const TEA_REWIND = JSON.stringify({revert: {VAL: "REVERTED"}, unset: ["BAZ"]})

      const config = { env: { SHELL: shell, TEA_REWIND } }
      await run(["+tea.xyz/magic", "-Esk", "--chaste", "env"], config) 

      const lines = getPrintedLines()
      assertEquals(envVar("FOO"), "BAR", "should set virtual env var")
      assertEquals(envVar("VAL"), "REVERTED", "should revert previous env")
      assert(isUnset("BAZ"), "should unset previous env")
      // use endswith instead of equality because osx sometimes resolves /private/var instead of /var
      assert(envVar("SRCROOT")?.endsWith(teaDir.string), "should set virtual env SRCROOT")

      const rewind = getRewind(shell, lines)
      assert(rewind != null, "rewind should be set")
      assert(rewind.unset.includes("FOO"), "should rewind FOO")
      assert(rewind.unset.includes("SRCROOT"), "should rewind SRCROOT")
    })
  }
})

Deno.test("should leave dev env", { sanitizeResources: false, sanitizeOps: false }, async test => {
  for (const shell of ["bash", "fish", "elvish"]) {
    await test.step(shell, async () => {
      const {run, getPrintedLines } = await createTestHarness({ sync: false })

      const envVar = (key: string) => getEnvVar(shell, getPrintedLines(), key)
      const isUnset = (key: string) => isEnvVarUnset(shell, getPrintedLines(), key)

      const TEA_REWIND = JSON.stringify({revert: {VAL: "REVERTED"}, unset: ["BAZ"]})

      const config = { env: { SHELL: shell, TEA_REWIND } }
      await run(["+tea.xyz/magic", "-Esk", "--chaste", "env"], config) 

      assertEquals(envVar("VAL"), "REVERTED", "should revert VAL")
      assert(isUnset("BAZ"), "rewind should be unset")
      assert(isUnset("TEA_REWIND"), "rewind should be unset")
    })
  }
})


function getEnvVar(shell: string, lines: string[], key: string): string | null {
  const pattern = () => {
    switch (shell) {
      case "fish":
        return `^set -gx ${key} '(.*)';$`
      case "elvish": 
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
      case "fish":
        return `^set -e ${key};$`
      case "elvish": 
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
