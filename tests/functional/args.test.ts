import { assertEquals } from "https://deno.land/std@0.176.0/testing/asserts.ts"
import { wut } from "../../src/app.main.ts"
import { useArgs } from "hooks/useFlags.ts"

Deno.test("args", async test => {
  await test.step("should use env", () => {
    const [args] = useArgs(["+zlib.net"], "/tea")
    assertEquals(wut(args), 'env')
  })

  await test.step("should exec", () => {
    const [args] = useArgs(["node"], "/tea")
    assertEquals(wut(args), 'exec')
  })

  await test.step("should enter repl", () => {
    const [args] = useArgs(["sh"], "/tea")
    assertEquals(wut(args), 'repl')
  })

  await test.step("should dry run", () => {
    const [args] = useArgs(["--dry-run"], "/tea")
    assertEquals(wut(args), 'dryrun')
  })
})
