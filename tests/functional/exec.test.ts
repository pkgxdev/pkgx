import { run } from "../../src/app.main.ts"
import { useArgs } from "hooks/useFlags.ts"
import { assertEquals, assertRejects } from "https://deno.land/std@0.176.0/testing/asserts.ts"
import { spy, stub, resolvesNext } from "https://deno.land/std@0.176.0/testing/mock.ts"
import { createTestHarness } from "./testUtils.ts"
import { RunError } from "hooks/useRun.ts"
import { ExitError } from "../../src/types.ts"

Deno.test("exec run error", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const {teaDir, useRunInternals } = await createTestHarness()
  const [args] = useArgs(["node", "--version"], teaDir.string)

  const err = new RunError(123, ["node", "--version"])
  const useRunStub = stub(useRunInternals, "run", resolvesNext<void, unknown>([err]))

  await assertRejects(async () => {
    try {
      await run(args) 
    } finally {
      useRunStub.restore()
    }
  }, ExitError, "exiting with code: 123", "should throw exit error")
})

Deno.test("exec", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const {teaDir, useRunInternals } = await createTestHarness()
  const [args] = useArgs(["node", "--version"], teaDir.string)

  const useRunSpy = spy(useRunInternals, "run")
  try {
    await run(args) 
  } finally {
    useRunSpy.restore()
  }

  assertEquals(useRunSpy.calls[0].args[0].cmd, ["node", "--version"], "should have run node --version")
})
