
import { assert, assertEquals } from "https://deno.land/std@0.176.0/testing/asserts.ts"
import { TeaError, error } from "utils"
import SemVer from "semver"

Deno.test("errors", async test => {
  await test.step("package not found", () => {
    const err = new TeaError("not-found: tea -X: arg0", { arg0: "foo.com" })
    assertEquals(err.code(), "spilt-tea-003")
    assertEquals(err.title(), "not-found: tea -X: arg0")
    assert(err.message.includes("couldn’t find a pkg to provide: \`foo.com\`"), "message should be subsititued correctly")
  })

  await test.step("project not found in pantry", () => {
    const err = new TeaError("not-found: pantry: package.yml", { project: "project-name" })
    assertEquals(err.code(), "spilt-tea-007")
    assertEquals(err.title(), "not found in pantry: project-name")
    assert(err.message.includes("Not in pantry: project-name"), "message should be subsititued correctly")
  })

  await test.step("wrap http error", () => {
    let err: TeaError | undefined
    try {
      error.wrap(() => {
        throw new Error("wrapped error")
      }, "http")()
    } catch (e) {
      err = e
    }

    assert(err, "error should be thrown")
    assertEquals(err.code(), "spilt-tea-013")
    assert(err.message.includes("wrapped error"), "message should be subsititued correctly")
  })

  await test.step("wrap Tea Error", () => {
    let err: TeaError | undefined
    try {
      error.wrap(() => {
        const pkg = { project: "foo.com", version: new SemVer("1.0.0") }
        throw new TeaError('not-found: pkg.version', { pkg })
      }, "http")()
    } catch (e) {
      err = e
    }

    assert(err, "error should be thrown")
    assertEquals(err.code(), "spilt-tea-006")
    assert(err.message.includes("we haven’t packaged foo.com=1.0.0."), "message should be subsititued correctly")
  })
})
