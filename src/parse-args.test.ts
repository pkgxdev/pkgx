import { assert, assertEquals, assertThrows, fail } from "deno/assert/mod.ts"
import { faker_args } from "./utils/test-utils.ts"
import parse_args from "./parse-args.ts"
import { UsageError } from "./utils/error.ts";

Deno.test("parse_args.ts", async runner => {
  await runner.step("+pkg", () => {
    const rv = parse_args(["+foo", "+bar@2", "-baz"])
    if (rv.mode !== 'env') fail()
    assertEquals(rv.pkgs.plus, ["foo", "bar@2"])
    assertEquals(rv.pkgs.minus, ["baz"])
  })

  await runner.step("--", () => {
    const args = faker_args()
    const rv = parse_args(['+foo', '--', ...args])
    if (rv.mode !== 'x') fail()
    assertEquals(rv.pkgs.plus, ["foo"])
    assertEquals(rv.args, args)
  })

  await runner.step("--long-args", async runner => {
    for (const arg of ['sync', 'update']) {
      await runner.step(`--${arg}`, () => {
        const args = faker_args()
        const rv = parse_args([`--${arg}`, ...args])
        if (rv.mode !== 'x') fail()
        assertEquals(rv.args, args)
        assert((rv.flags as any)[arg])
      })
    }
  })

  await runner.step("verbosity", () => {
    assertEquals(parse_args(['--verbose']).flags.verbosity, 1)
    assertEquals(parse_args(['--verbose=-2']).flags.verbosity, -2)
    assertEquals(parse_args(['--silent', '--verbose=2']).flags.verbosity, 2)
    assertEquals(parse_args(['--verbose=2', '--quiet']).flags.verbosity, -1)
  })

  await runner.step("UsageError", () => {
    assertThrows(() => parse_args(['--syncs']))
    assertThrows(() => parse_args(['+']))
    assertThrows(() => parse_args(['-']))
  })

  await runner.step("--internal.use", () => {
    const args = faker_args()
    const rv = parse_args(['--internal.use', ...args.map(x => `+${x}`)])
    if (rv.mode !== 'internal.use') fail()
    assertEquals(rv.pkgs.plus, args)
  })

  await runner.step("--shellcode", () => {
    const args = faker_args()
    const rv = parse_args(['--shellcode', ...args])
    assertEquals(rv.mode, 'shellcode')
  })

  await runner.step("run", () => {
    const args = faker_args()
    const rv = parse_args(['run', ...args])
    if (rv.mode != 'run') fail()
    assertEquals(rv.args, args)
  })

  await runner.step("which", () => {
    const args = faker_args()
    const rv = parse_args(['--which', ...args])
    if (rv.mode != 'which') fail()
    assertEquals(rv.args, args)
  })

  await runner.step("install", () => {
    const args = faker_args()
    const rv = parse_args(['install', ...args])
    if (rv.mode != 'install') fail()
    assertEquals(rv.args, args)
  })

  await runner.step("--internal.activate", () => {
    const args = ['/foo/bar', ...faker_args()]
    const rv = parse_args(['--internal.activate', ...args])
    if (rv.mode != 'internal.activate') fail()
    assertEquals(rv.dir.string, args[0])
  })

  await runner.step("multiple modes", () => {
    assertThrows(() => parse_args(['--shellcode', '--internal.use']), UsageError, 'multiple modes specified')
    assertThrows(() => parse_args(['--internal.use', '--shellcode']), UsageError, 'multiple modes specified')
    assertThrows(() => parse_args(['--internal.use', '--which']), UsageError, 'multiple modes specified')
    assertThrows(() => parse_args(['--shellcode', '--help']), UsageError, 'multiple modes specified')
  })

  await runner.step("deintegrate", () => {
    const args = faker_args()
    const rv = parse_args(['deintegrate', ...args])
    assertEquals(rv.mode, 'deintegrate')
  })
})
