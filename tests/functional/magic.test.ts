import { assert } from "deno/testing/asserts.ts"
import { createTestHarness } from "./testUtils.ts"

Deno.test("magic", { sanitizeResources: false, sanitizeOps: false }, async test => {
    await test.step("/bin/bash", async () => {
      const { run, teaDir } = await createTestHarness({sync: false})
      const { stdout } =await run(["--magic"], { env: { SHELL: "/bin/bash" }})

      const expected = `source /dev/stdin <<<"$("${teaDir.parent()}"/tea +tea.xyz/magic -Esk --chaste env)"`
      assert(stdout[0].includes(expected))
    })

    await test.step("/bin/zsh", async () => {
      const { run, teaDir } = await createTestHarness({sync: false})
      const { stdout } = await run(["--magic"], { env: { SHELL: "/bin/zsh" }})
      const expected = `source <("${teaDir.parent()}"/tea +tea.xyz/magic -Esk --chaste env)`
      assert(stdout[0].includes(expected))
    })

    await test.step("/bin/fish", async () => {
      const { run, teaDir } = await createTestHarness({sync: false})
      const { stdout } = await run(["--magic"], { env: { SHELL: "/bin/fish" }})
      const expected = `"${teaDir.parent()}"/tea --env --keep-going --silent --dry-run=w/trace | source`
      assert(stdout[0].includes(expected))
    })

    await test.step("/bin/elvish", async () => {
      const { run, teaDir } = await createTestHarness({sync: false})
      const { stdout } = await run(["--magic"], { env: { SHELL: "/bin/elvish" }})
      const expected = `eval ("${teaDir.parent()}"/tea +tea.xyz/magic -Esk --chaste env | slurp)`
      assert(stdout[0].includes(expected))
    })
})

