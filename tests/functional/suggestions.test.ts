import { suggestions } from "../../src/hooks/useErrorHandler.ts"
import { assert, assertEquals } from "deno/testing/asserts.ts"
import { createTestHarness } from "./testUtils.ts"
import { TeaError, SemVer, PackageNotFoundError, ResolveError } from "tea"

Deno.test("suggestions", { sanitizeResources: false, sanitizeOps: false }, async test => {
  // suggestions need a sync to occur first
  const { run } = await createTestHarness({sync: true})
  run(["-Sh"]) // or test fails due to lack of config being set

  await test.step("suggest package name", async () => {
    const err = new PackageNotFoundError("nodejs.org")
    const sugg = await suggestions(err)
    assertEquals(sugg, "did you mean `nodejs.org`? otherwise… see you on GitHub?")
  })

  await test.step("suggest package version", async () => {
    const pkg = { project: "nodejs.org", version: new SemVer("1.2.3") }
    const err = new ResolveError(pkg)
    const sugg = await suggestions(err)
    assert(sugg?.includes("18.15.0"), "should suggest an existing version")
  })
})
