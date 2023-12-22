// deno-lint-ignore-file require-await
import { assertEquals, assertRejects, assertThrows } from "deno/assert/mod.ts"
import specimen, { NoEntrypointError, _internals } from "./run.ts"
import { Path, SemVer, semver, hooks } from "pkgx"
import { faker_args } from "../utils/test-utils.ts"
import * as mock from "deno/testing/mock.ts"

Deno.test("run.ts", async runner => {
  const opts = { pkgs: [], update: false, logger: { replace: () => {}, clear: () => {}, upgrade: () => null as any } }

  await runner.step("happy", async () => {
    const args = faker_args()
    const pkg = { project: "foo.com", constraint: new semver.Range("^2") }

    const stub1 = mock.stub(_internals, "parse_pkg_str", () => (Promise.resolve(pkg)))
    const stub2 = mock.stub(_internals, "get_entrypoint", () => Promise.resolve(args.join(' ')))
    const stub3 = mock.stub(_internals, "install", async () => {
      const installations = [
        { pkg: {project: "foo.com", version: new SemVer("2.3.4")}, path: new Path("/opt/foo.com/v2.3.4") },
        { pkg: {project: "bar.org", version: new SemVer("1.2.3")}, path: new Path("/opt/bar.org/v1.2.3") }
      ]
      return { installations, pkgenv: [] }
    })
    const stub4 = mock.stub(_internals, "construct_env", () => (Promise.resolve({})))
    const stub5 = mock.stub(_internals, "chdir", dir => assertEquals(dir, new Path("/opt/foo.com/v2.3.4").string))
    const stub6 = stub_execve(args)

    try {
      await specimen(args.slice(0, 1), opts)
    } finally {
      stub1.restore()
      stub2.restore()
      stub3.restore()
      stub4.restore()
      stub5.restore()
      stub6.restore()
    }
  })

  await runner.step("no endpoint", async () => {
    const args = faker_args()
    const pkg = { project: "foo.com", constraint: new semver.Range("^2") }

    const stub1 = mock.stub(_internals, "parse_pkg_str", () => (Promise.resolve(pkg)))
    const stub2 = mock.stub(_internals, "get_entrypoint", async () => { return undefined })

    try {
      await assertRejects(() => specimen(args.slice(0, 1), opts), NoEntrypointError)
    } finally {
      stub1.restore()
      stub2.restore()
    }
  })

  await runner.step("coverage++", async () => {
    if (hooks.usePantry().missing()) {
      await assertRejects(async () => await _internals.get_entrypoint({project: "github.com/ggerganov/llama.cpp"}))
    } else {
      await _internals.get_entrypoint({project: "github.com/ggerganov/llama.cpp"})
    }
  })
})


function stub_execve(expected_cmd: string[]) {
  return mock.stub(_internals, "exec", ({cmd}) => {
    assertEquals(expected_cmd, cmd)
    return undefined as never
  })
}
