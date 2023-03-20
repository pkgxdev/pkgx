import { assertEquals, assertRejects } from "https://deno.land/std@0.176.0/testing/asserts.ts"
import { spy, stub, returnsNext } from "https://deno.land/std@0.176.0/testing/mock.ts"
import { createTestHarness, newMockProcess } from "./testUtils.ts"
import { ExitError } from "types"

Deno.test("exec", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const {run, useRunInternals } = await createTestHarness()

  const useRunSpy = spy(useRunInternals, "nativeRun")
  try {
    await run(["node", "--version"]) 
  } finally {
    useRunSpy.restore()
  }

  assertEquals(useRunSpy.calls[0].args[0].cmd, ["node", "--version"], "should have run node --version")
})

Deno.test("exec run error", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const {run, useRunInternals } = await createTestHarness()

  const mockProc = newMockProcess()
  mockProc.status = () => Promise.resolve({success: false, code: 123})

  const useRunStub = stub(useRunInternals, "nativeRun", returnsNext([mockProc]))

  await assertRejects(async () => {
    try {
      await run(["node", "--version"]) 
    } finally {
      useRunStub.restore()
    }
  }, ExitError, "exiting with code: 123", "should throw exit error")
})

Deno.test("forward env to exec", { sanitizeResources: false, sanitizeOps: false }, async () => { 
  const {run, TEA_PREFIX, useRunInternals } = await createTestHarness()

  const useRunSpy = spy(useRunInternals, "nativeRun")
  try {
    await run(["sh", "-c", "echo $TEA_PREFIX"]) 
  } finally {
    useRunSpy.restore()
  }

  assertEquals(useRunSpy.calls[0].args[0].env?.["TEA_PREFIX"], TEA_PREFIX.string)
})
