import { assert } from "https://deno.land/std@0.176.0/testing/asserts.ts"
import { createTestHarness } from "./testUtils.ts"

Deno.test("suggestions", { sanitizeResources: false, sanitizeOps: false }, async test => {
    await test.step("/bin/bash", async () => {
      const { run, teaDir, getPrintedLines } = await createTestHarness({sync: false})
      await run(["--magic"], { execPath: teaDir, env: { SHELL: "/bin/bash" }})
      const expected = `source <("${teaDir.parent()}"/tea +tea.xyz/magic -Esk --chaste env)`
      assert(getPrintedLines()[0].includes(expected))
    })

    await test.step("/bin/zsh", async () => {
      const { run, teaDir, getPrintedLines } = await createTestHarness({sync: false})
      await run(["--magic"], { execPath: teaDir, env: { SHELL: "/bin/zsh" }})
      const expected = `source <("${teaDir.parent()}"/tea +tea.xyz/magic -Esk --chaste env)`
      assert(getPrintedLines()[0].includes(expected))
    })

    await test.step("/bin/fish", async () => {
      const { run, teaDir, getPrintedLines } = await createTestHarness({sync: false})
      await run(["--magic"], { execPath: teaDir, env: { SHELL: "/bin/fish" }})
      const expected = `"${teaDir.parent()}"/tea --env --keep-going --silent --dry-run=w/trace | source`
      assert(getPrintedLines()[0].includes(expected))
    })

    await test.step("/bin/elvish", async () => {
      const { run, teaDir, getPrintedLines } = await createTestHarness({sync: false})
      await run(["--magic"], { execPath: teaDir, env: { SHELL: "/bin/elvish" }})
      const expected = `eval ("${teaDir.parent()}"/tea +tea.xyz/magic -Esk --chaste env | slurp)`
      assert(getPrintedLines()[0].includes(expected))
    })
})

