import { suggestions } from "../../src/hooks/useErrorHandler.ts"
import { assert, assertEquals } from "deno/testing/asserts.ts"
import { createTestHarness } from "./testUtils.ts"
import { TeaError, SemVer } from "tea"

Deno.test("suggestions", { sanitizeResources: false, sanitizeOps: false }, async test => {
  // suggestions need a sync to occur first
  await createTestHarness({sync: true})

  await test.step("suggest package name", async () => {
    const err = new TeaError("not-found: pantry: package.yml", { project: "node" })
    const sugg = await suggestions(err)
    assertEquals(sugg, "did you mean `nodejs.org`? otherwise… see you on GitHub?")
  })

  await test.step("suggest package version", async () => {
    const pkg = { project: "nodejs.org", version: new SemVer("1.2.3") }
    const err = new TeaError("not-found: pkg.version", { pkg })
    const sugg = await suggestions(err)
    assert(sugg?.includes("18.15.0"), "should suggest an existing version")
  })
})
