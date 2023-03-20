import { assertEquals } from "deno/testing/asserts.ts"
import { wut } from "../../src/app.main.ts"
import { parseArgs } from "../../src/args.ts"
import { init } from "../../src/init.ts"

Deno.test("parse args", async test => {
  await test.step("verbosity - int", () => {
    const [_args, flags] = parseArgs(["-S", "--verbose=4"], "/tea")
    assertEquals(flags.verbosity, 5)
  })

  await test.step("verbosity - bool", () => {
    const [_args, flags] = parseArgs(["-S", "--verbose=true"], "/tea")
    assertEquals(flags.verbosity, 1)
  })

  await test.step("verbosity - off", () => {
    const [_args, flags] = parseArgs(["-S", "--verbose=off"], "/tea")
    assertEquals(flags.verbosity, 0)
  })

  await test.step("verbosity - short style", () => {
    const [_args, flags] = parseArgs(["-S", "-vvvv"], "/tea")
    assertEquals(flags.verbosity, 4)
  })

  await test.step("verbosity - debug", () => {
    const [_args, flags] = parseArgs(["-S", "--debug"], "/tea")
    assertEquals(flags.verbosity, 2)
  })

  await test.step("verbosity - debug=1", () => {
    const [_args, flags] = parseArgs(["-S", "--debug=1"], "/tea")
    assertEquals(flags.verbosity, 2)
  })

  await test.step("verbosity - debug=false", () => {
    const [_args, flags] = parseArgs(["-S", "--debug=false"], "/tea")
    assertEquals(flags.verbosity, 0)
  })

  await test.step("cd - long", () => {
    const [args] = parseArgs(["--cd", "/tmp", "node", "run.js"], "/tea")
    assertEquals(args.cd?.string, "/tmp")
    assertEquals(args.args, ["node", "run.js"])
  })

  await test.step("cd - short", () => {
    const [args] = parseArgs(["-C", "/tmp", "node", "run.js"], "/tea")
    assertEquals(args.cd?.string, "/tmp")
    assertEquals(args.args, ["node", "run.js"])
  })

  await test.step("dryrun - long", () => {
    const [_args, flags] = parseArgs(["-S", "--dry-run"], "/tea")
    assertEquals(flags.dryrun, true)
  })

  await test.step("dryrun - short", () => {
    const [_args, flags] = parseArgs(["-S", "-n"], "/tea")
    assertEquals(flags.dryrun, true)
  })

  await test.step("help", () => {
    const [args] = parseArgs(["-h"], "/tea")
    assertEquals(args.mode, 'help')
  })

  await test.step("arg seperator", () => {
    const [args, flags] = parseArgs(["-S", "--", "node", "run.js", "-n", "1", "-h", "2"], "/tea")
    assertEquals(args.args, ["node", "run.js", "-n", "1", "-h", "2"])
    assertEquals(args.mode, "std")
    assertEquals(flags.dryrun, false)
  })
})

Deno.test("wut args", async test => {
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
