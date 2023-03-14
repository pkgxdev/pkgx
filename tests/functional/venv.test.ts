import { createTestHarness } from "./testUtils.ts";
import { assert } from "https://deno.land/std@0.176.0/testing/asserts.ts"

Deno.test("should dump env", { sanitizeResources: false, sanitizeOps: false }, async test => {
  await test.step("bash", async () => {
    const {run, teaDir, getPrintedLines } = await createTestHarness({ sync: false })

    Deno.writeTextFileSync(teaDir.join("tea.yml").string, "env:\n  FOO: BAR\n")

    const config = {env: { TEA_DIR: teaDir.string, SHELL: "bash" }}
    await run(["+tea.xyz/magic", "-Esk", "--chaste", "env"], config) 

    const lines = getPrintedLines()
    assert(lines.includes("export FOO='BAR'"), "should set virtual env var")
    assert(lines.includes(`export SRCROOT='${teaDir.string}'`), "should set virtual env SRCROOT")

    const rewind = getRewind(lines, "^export TEA_REWIND='(.*)'$")
    assert(rewind != null, "rewind should be set")
    assert(rewind.unset.includes("FOO"), "should rewind FOO")
    assert(rewind.unset.includes("SRCROOT"), "should rewind SRCROOT")
  })
})

interface Rewind {
  revert: Record<string, string>
  unset: string[]
}

function getRewind (lines: string[], pattern: string): Rewind | null {
  for (const line of lines) {
    const m = new RegExp(pattern).exec(line)
    if (m && m.length > 1) {
      return JSON.parse(m[1]) as Rewind
    }
  }
  return null
}
