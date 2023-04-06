import { assertRejects } from "deno/testing/asserts.ts"
import { ExitError } from "types"
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
      return run(["--provides", "node"], { env: { TEA_PKGS: "nodejs.org=18.14.2"} })
    }, ExitError, "exiting with code: 0")
  })

  await test.step("does not provide", async () => {
    const { run } = await createTestHarness()
    await assertRejects(() => run(["--provides", "this-isn't-a-real-package-name"]), ExitError, "exiting with code: 1")
  })

  await test.step("does not provide version", async () => {
    const { run } = await createTestHarness()
    await assertRejects(() => run(["--provides", "node@newest"]), ExitError, "exiting with code: 1")
  })

  await test.step("dark magic provides -- npx create-react-app", async () => {
    const { run } = await createTestHarness()
    await assertRejects(() => run(["--provides", "create-react-app"]), ExitError, "exiting with code: 0")
  })

  await test.step("dark magic provides -- pipx run armone", async () => {
    const { run } = await createTestHarness()
    await assertRejects(() => run(["--provides", "armone"]), ExitError, "exiting with code: 0")
  })

  // FIXME: once you _execute_ cargo install, `--provides` returns false,
  // since it's in the path at that point. But I doubt uninstalling after
  // run is the right answer.
  await test.step("dark magic provides -- cargo install grex", async () => {
    const { run } = await createTestHarness()
    await assertRejects(() => run(["--provides", "grex"]), ExitError, "exiting with code: 0")
  })
})
