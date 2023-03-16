import { assertEquals } from "https://deno.land/std@0.176.0/testing/asserts.ts"
import { useErrorHandler } from "hooks";
import { Config, _internals } from "hooks/useConfig.ts"
import { ExitError } from "types"
import { TeaError } from "utils";

Deno.test("useErrorHandler", async test => { 
  _internals.setConfig({silent: false, debug: true} as Config)

  await test.step("exit error", async () => {
    const rc = await useErrorHandler(new ExitError(123))
    assertEquals(rc, 123)
  })

  await test.step("tea error", async () => {
    const err = new TeaError("not-found: pantry", { project: "foo.com", cause: { message: "error" } })
    const rc = await useErrorHandler(err)
    assertEquals(rc, 9)
  })

  await test.step("normal error", async () => {
    const rc = await useErrorHandler(new Error("unit test error"))
    assertEquals(rc, 128)
  })
})

Deno.test("useErrorHandler silent", async test => { 
  _internals.setConfig({silent: true, debug: false} as Config)

  await test.step("normal error", async () => {
    const rc = await useErrorHandler(new Error("unit test error"))
    assertEquals(rc, 1)
  })
})
