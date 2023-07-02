import { assertEquals, assertRejects } from "deno/testing/asserts.ts"
import { spy, stub, returnsNext } from "deno/testing/mock.ts"
import { createTestHarness, newMockProcess } from "./testUtils.ts"
import { TeaError } from "tea"

// Deno.test("exec", { sanitizeResources: false, sanitizeOps: false }, async () => {
//   const { run } = await createTestHarness(undefined)
//   const { runspy } = await run(["node", "--version"])
//   const foo = runspy.calls[0].args[0].cmd
//   assertEquals(foo, ["node", "--version"], "should have run node --version")
// })

// Deno.test("forward env to exec", { sanitizeResources: false, sanitizeOps: false }, async () => {
//   const { run, TEA_PREFIX } = await createTestHarness()
//   const { runspy } = await run(["sh", "-c", "echo $TEA_PREFIX"])
//   assertEquals(runspy.calls[0].args[0].env?.["TEA_PREFIX"], TEA_PREFIX.string)
// })

// Deno.test("exec run errors", { sanitizeResources: false, sanitizeOps: false }, async test => {
//   const tests = [
//     {
//       name: "normal error",
//       procStatus: (): Promise<Deno.CommandStatus> => Promise.reject(new Error("test error")),
//       expectedErr: "exiting with code: 1",
//     },
//     {
//       name: "tea error",
//       procStatus: (): Promise<Deno.CommandStatus> => Promise.reject(new TeaError("confused: interpreter", {})),
//       expectedErr: "exiting with code: 1",
//     },
//     {
//       name: "not found",
//       procStatus: (): Promise<Deno.CommandStatus> => Promise.reject(new Deno.errors.NotFound()),
//       expectedErr: "exiting with code: 127",
//     },
//     {
//       name: "permission denied",
//       procStatus: (): Promise<Deno.CommandStatus> => Promise.reject(new Deno.errors.PermissionDenied()),
//       expectedErr: "exiting with code: 127",
//     },
//   ]

//   for (const { name, procStatus, expectedErr } of tests) {
//     await test.step(name, async () => {
//       const { run, useRunInternals } = await createTestHarness(undefined, false)
//       const mockProc = newMockProcess(procStatus)

//       const useRunStub = stub(useRunInternals, "nativeRun", returnsNext([mockProc]))
//       await assertRejects(async () => {
//         try {
//           await run(["node", "--version"])
//         } finally {
//           useRunStub.restore()
//         }
//       }, expectedErr)
//     })
//   }
// })

Deno.test("exec forkbomb protector", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const { run } = await createTestHarness()
  await assertRejects(
    () => run(["sh", "-c", "echo $TEA_PREFIX"], { env: {TEA_FORK_BOMB_PROTECTOR: "21", obj: {} }}),
    "FORK BOMB KILL SWITCH ACTIVATED")
})
