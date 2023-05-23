import { ConfigDefault } from "../../src/hooks/useConfig.ts"
import { useErrorHandler, Verbosity, ExitError } from "hooks"
import { assertEquals } from "deno/testing/asserts.ts"
import { TeaError, hooks } from "tea"
const { useConfig } = hooks

Deno.test("useErrorHandler", async test => {
  const config = ConfigDefault()
  config.modifiers.verbosity = Verbosity.debug
  useConfig(config)

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
  const config = ConfigDefault()
  config.modifiers.verbosity = Verbosity.quiet
  useConfig(config)

  await test.step("normal error", async () => {
    const rc = await useErrorHandler(new Error("unit test error"))
    assertEquals(rc, 1)
  })
})
