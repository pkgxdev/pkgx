import { ExitError } from "../../src/hooks/useErrorHandler.ts"
import { assertRejects } from "deno/testing/asserts.ts"
import { createTestHarness } from "./testUtils.ts"

Deno.test("provides", { sanitizeResources: false, sanitizeOps: false }, async test => {
  await test.step("no version", async () => {
    const { run } = await createTestHarness()
    await assertRejects(() => run(["--provides", "node"]), ExitError, "exiting with code: 0")
  })

  await test.step("provides version", async () => {
    const { run } = await createTestHarness()
    await assertRejects(() => run(["--provides", "node^18"]), ExitError, "exiting with code: 0")
  })

  await test.step("provides version in dev env", async () => {
    const { run } = await createTestHarness()
    await assertRejects(() => {
      return run(["--provides", "node"], { env: { TEA_PKGS: "nodejs.org=18.14.2", obj: {} } })
    }, ExitError, "exiting with code: 0")
  })

  await test.step("does not provide", async () => {
    const { run } = await createTestHarness()
    await assertRejects(() => run(["--provides", "foobar"]), ExitError, "exiting with code: 1")
  })

  await test.step("does not provide version", async () => {
    const { run } = await createTestHarness()
    await assertRejects(() => run(["--provides", "node@newest"]), ExitError, "exiting with code: 1")
  })
})
