import { assertEquals } from "https://deno.land/std@0.176.0/testing/asserts.ts"
import { wut } from "../../src/app.main.ts"
import { parseArgs } from "../../src/args.ts"
import { init } from "../../src/init.ts"

Deno.test("args", async test => {
  const runTest = (a: string[]) => {
    const [args, flags] = parseArgs(a, "/tea")
    init(flags)
    return wut(args)
  }

  await test.step("should use env", () => {
    assertEquals(runTest(["+zlib.net"]), 'env')
  })

  await test.step("should exec", () => {
    assertEquals(runTest(["node", "--version"]), 'exec')
  })

  await test.step("should enter repl", () => {
    assertEquals(runTest(["sh"]), "repl")
  })

  await test.step("should dry run", () => {
    assertEquals(runTest(["--dry-run"]), "dryrun")
  })

  await test.step("should dump env", () => {
    assertEquals(runTest(["+tea.xyz/magic", "env"]), "dump")
  })
})

