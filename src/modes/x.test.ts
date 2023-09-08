// deno-lint-ignore-file require-await no-explicit-any
import { assertEquals, assertRejects, fail } from "deno/assert/mod.ts"
import { Path, SemVer, TeaError, semver } from "tea"
import { faker_args } from "../utils/test-utils.ts"
import { ProvidesError } from "../utils/error.ts"
import specimen, { _internals } from "./x.ts"
import * as mock from "deno/testing/mock.ts"

//TODO use a testLibTea thing (libtea provides this)
//TODO add faker methods for more of what we hardcode here


Deno.test("x.ts", async runner => {

  const opts = { update: false, logger: { replace: () => {}, clear: () => {}, upgrade: () => null as any } }

  await runner.step("unprovided throws", async () => {
    const stub1 = mock.stub(_internals, "which", () => Promise.resolve(undefined))
    const stub2 = mock.stub(_internals, "useSync", () => Promise.resolve(undefined))
    try {
      await assertRejects(
        () => specimen(faker_args(), opts),
        ProvidesError)
    } finally {
      stub1.restore()
      stub2.restore()
    }
  })

  await runner.step("arg0 with absolute path is pass through", async () => {
    const path = Path.mktemp().join("foo").touch()
    const args = [path.string, ...faker_args()]
    const stub1 = stub_execve()
    const stub2 = mock.stub(_internals, "install", async pkgs => {
      assertEquals(pkgs.length, 0)
      return { installations: [], pkgenv: [] }
    })

    try {
      await specimen(args, opts)  //TODO shouldn't be specifying update: false, should just be mocking libtea

      assertEquals(stub1.calls.length, 1)
      assertEquals(stub1.calls[0].args[0].cmd, args)

    } finally {
      stub1.restore()
      stub2.restore()
    }
  })

  await runner.step("installs deps", async runner => {
    const args = faker_args()
    const pkg = { project: "foo.com", constraint: new semver.Range("^2") }
    const stub1 = stub_execve()
    const stub2 = mock.stub(_internals, "construct_env", async () => ({ PATH: "/a:${PATH}" }))
    const stub3 = mock.stub(_internals, "install", async () => {
      const installations = [
        { pkg: {project: "foo.com", version: new SemVer("2.3.4")}, path: new Path("/opt/foo.com/v2.3.4") },
        { pkg: {project: "bar.org", version: new SemVer("1.2.3")}, path: new Path("/opt/bar.org/v1.2.3") }
      ]
      return { installations, pkgenv: [] }
    })
    const stub4 = mock.stub(_internals, "which", () => Promise.resolve({...pkg, shebang: args.slice(0, 1) }))

    try {
      await runner.step("std", () => specimen(args, opts))

      assertEquals(stub1.calls.length, 1)
      assertEquals(stub1.calls[0].args[0].cmd, args)

      await runner.step("@latest", async runner => {
        const new_args = [`${args[0]}@latest`, ...args.slice(1)]
        await runner.step("std", () => specimen(new_args, opts))

        assertEquals(stub1.calls.length, 2)
        assertEquals(stub1.calls[1].args[0].cmd, args)

        await runner.step("std w/update-set", () => specimen(new_args, {...opts, update: new Set()}))

        assertEquals(stub1.calls.length, 3)
        assertEquals(stub1.calls[2].args[0].cmd, args)
      })
      await runner.step("invalid TEA_LVL", async () => {
        const stub = mock.stub(_internals, "getenv", () => "")
        try {
          await assertRejects(() => specimen(args, opts))
        } finally {
          stub.restore()
        }
      })
    } finally {
      stub1.restore()
      stub2.restore()
      stub3.restore()
      stub4.restore()
    }
  })

  await runner.step("resolves foo@3 but runs foo", async () => {
    const pkg = { project: "foo.com", version: new SemVer("3.4.5") }
    const pkgspec = { project: "foo.com", constraint: new semver.Range("^3") }
    const installations = [{ pkg, path: new Path(`/opt/${pkg.project}/v${pkg.version}`) }]
    const stub1 = mock.stub(_internals, "which", () => Promise.resolve({...pkgspec, shebang: ["foo"] }))
    const stub2 = mock.stub(_internals, "install", () => Promise.resolve({installations, pkgenv : []}))
    const stub3 = mock.stub(_internals, "construct_env", () => (Promise.resolve({})))
    const args = ['foo', 'bar']
    const stub4 = stub_execve()
    try {
      await specimen(['foo@3', 'bar'], opts)

      assertEquals(stub4.calls.length, 1)
      assertEquals(stub4.calls[0].args[0].cmd, args)

    } finally {
      stub1.restore()
      stub2.restore()
      stub3.restore()
      stub4.restore()
    }
  })

  await runner.step("multiarg shebangs run", async () => {
    const pkg = { project: "foo.com", version: new SemVer("3.4.5") }
    const pkgspec = { project: "foo.com", constraint: new semver.Range("^3") }
    const installations = [{ pkg, path: new Path(`/opt/${pkg.project}/v${pkg.version}`) }]
    const stub1 = mock.stub(_internals, "which", () => Promise.resolve({...pkgspec, shebang: ["foo", "bar"] }))
    const stub2 = mock.stub(_internals, "install", () => Promise.resolve({ installations, pkgenv: []}))
    const args = ['foo', 'bar', 'baz']
    const stub3 = stub_execve()
    const stub4 = mock.stub(_internals, "construct_env", () => (Promise.resolve({})))
    try {
      await specimen(['foo', 'baz'], opts)

      assertEquals(stub3.calls.length, 1)
      assertEquals(stub3.calls[0].args[0].cmd, args)
    } finally {
      stub1.restore()
      stub2.restore()
      stub3.restore()
      stub4.restore()
    }
  })

  // await runner.step("asked to run something in active pkgenv", async () => {
  //   const env = {
  //     "TEA_PKGENV": "foo.com^2"
  //   }
  //   const stub1 = mock.stub(_internals, "which", async () => ({project: "foo.com", constraint: new semver.Range('*'), shebang: ["foo"] }))
  //   const stub2 = mock.stub(_in_active_pkg_env_internals, "getenv", () => env["TEA_PKGENV"])
  //   const stub3 = mock.stub(_internals, "superenv", () => env)
  //   const stub4 = stub_execve()
  //   try {
  //     await specimen(["foo", "bar"], opts)

  //     assertEquals(stub4.calls.length, 1)
  //     assertEquals(stub4.calls[0].args[0].cmd, ["foo", "bar"])
  //   } finally {
  //     stub1.restore()
  //     stub2.restore()
  //     stub3.restore()
  //     stub4.restore()
  //   }
  // })

  await runner.step("asked to run something in active pkgenv, but constraint is outside of it", async () => {
    const env: Record<string, string | undefined> = {
      "TEA_PKGENV": "foo.com=2.3.4"
    }
    const pkg = { project: "foo.com", version: new SemVer("3.4.5") }
    const installations = [{ pkg, path: new Path(`/opt/${pkg.project}/v${pkg.version}`) }]
    const stub1 = mock.stub(_internals, "which", async () => ({project: "foo.com", constraint: new semver.Range('^3'), shebang: ["foo"] }))
    const stub3 = mock.stub(_internals, "getenv", key => env[key])
    const stub4 = stub_execve()
    const stub5 = mock.stub(_internals, "install", () => Promise.resolve({ installations, pkgenv: []}))
    const stub6 = mock.stub(_internals, "construct_env", () => (Promise.resolve({})))
    try {
      await specimen(["foo@3", "bar"], opts)

      assertEquals(stub4.calls.length, 1)
      assertEquals(stub4.calls[0].args[0].cmd, ["foo", "bar"])
    } finally {
      stub1.restore()
      stub3.restore()
      stub4.restore()
      stub5.restore()
      stub6.restore()
    }
  })

  await runner.step("file path but doesn’t exist", async () => {
    const stub1 = mock.stub(_internals, "which", () => Promise.resolve(undefined))
    const stub2 = mock.stub(_internals, "useSync", async () => { fail() })
    try {
      await assertRejects(
        () => specimen(["/foo/bar"], opts),
        TeaError)
    } finally {
      stub1.restore()
      stub2.restore()
    }
  })

  await runner.step("undecorated file path that exists", async () => {
    const newwd = Path.mktemp().join("foo").touch().parent()
    const oldwd = Path.cwd()

    const stub1 = mock.stub(_internals, "which", () => Promise.resolve(undefined))
    const stub2 = mock.stub(_internals, "useSync", async () => { fail() })
    const stub3 = stub_execve()

    try {
      Deno.chdir(newwd.string)
      await specimen(["foo"], opts)

      assertEquals(stub3.calls.length, 1)
      assertEquals(stub3.calls[0].args[0].cmd, ["foo"])
    } finally {
      Deno.chdir(oldwd.string)
      stub1.restore()
      stub2.restore()
      stub3.restore()
    }
  })

  await runner.step("failsafe", async () => {
    let i = 0
    let useSyncCalled = 0
    const stub1 = mock.stub(_internals, "which", async () => i++ ? { project: "foo", constraint: new semver.Range('*'), shebang: ['baz'] } : undefined)
    const stub2 = mock.stub(_internals, "useSync", async () => { useSyncCalled++ })
    const stub3 = stub_execve()
    const stub4 = mock.stub(_internals, "install", () => Promise.resolve({ installations: [], pkgenv: []}))
    const stub5 = mock.stub(_internals, "construct_env", () => (Promise.resolve({})))

    try {
      await specimen(["foo", "bar"], opts)

      assertEquals(i, 2)
      assertEquals(useSyncCalled, 1)

      assertEquals(stub3.calls.length, 1)
      assertEquals(stub3.calls[0].args[0].cmd, ["baz", "bar"])
    } finally {
      stub1.restore()
      stub2.restore()
      stub3.restore()
      stub4.restore()
      stub5.restore()
    }
  })

  await runner.step("resolves shebang", async () => {
    const f = Path.mktemp().join('foo').touch()
    const shebang_args = ['deno', 'run']
    const args_to_script = ['--arg-to-script1', '--arg-to-script2']
    const pkg = { project: "foo.com", constraint: new semver.Range("^2") }
    const stub1 = stub_execve()
    const stub2 = mock.stub(_internals, "construct_env", () => (Promise.resolve({})))
    const stub3 = mock.stub(_internals, "install", async () => {
      const installations = [
        { pkg: {project: "foo.com", version: new SemVer("2.3.4")}, path: new Path("/opt/foo.com/v2.3.4") },
        { pkg: {project: "bar.org", version: new SemVer("1.2.3")}, path: new Path("/opt/bar.org/v1.2.3") }
      ]
      return { installations, pkgenv: [] }
    })
    const stub4 = mock.stub(_internals, "which", () => Promise.resolve({...pkg, shebang: ['should', 'be', 'ignore', 'this'] }))
    const stub5 = mock.stub(_internals, "getenv", () => undefined)
    const stub6 = mock.stub(_internals, "get_shebang", () => Promise.resolve(shebang_args))

    try {
      await specimen([f.string, ...args_to_script], opts)

      assertEquals(stub1.calls.length, 1)
      assertEquals(stub1.calls[0].args[0].cmd, [...shebang_args, f.string, ...args_to_script])
    } finally {
      stub1.restore()
      stub2.restore()
      stub3.restore()
      stub4.restore()
      stub5.restore()
      stub6.restore()
    }
  })

  await runner.step("resolves interpreter", async () => {
    const f = Path.mktemp().join('foo').touch()
    const shebang_args = ['deno', 'run']
    const args_to_script = ['--arg-to-script1', '--arg-to-script2']
    const pkg = { project: "foo.com", constraint: new semver.Range("^2") }
    const stub1 = stub_execve()
    const stub2 = mock.stub(_internals, "construct_env", () => (Promise.resolve({})))
    const stub3 = mock.stub(_internals, "install", async () => {
      const installations = [
        { pkg: {project: "foo.com", version: new SemVer("2.3.4")}, path: new Path("/opt/foo.com/v2.3.4") },
        { pkg: {project: "bar.org", version: new SemVer("1.2.3")}, path: new Path("/opt/bar.org/v1.2.3") }
      ]
      return { installations, pkgenv: [] }
    })
    const stub4 = mock.stub(_internals, "which", () => Promise.resolve({...pkg, shebang: ['should', 'ignore', 'these'] }))
    const stub5 = mock.stub(_internals, "getenv", () => undefined)
    const stub6 = mock.stub(_internals, "get_shebang", () => Promise.resolve(undefined))
    const stub7 = mock.stub(_internals, "get_interpreter", async () => ({project: 'foo.com', args: shebang_args}))

    try {
      await specimen([f.string, ...args_to_script], opts)

      assertEquals(stub1.calls.length, 1)
      assertEquals(stub1.calls[0].args[0].cmd, [...shebang_args, f.string, ...args_to_script])
    } finally {
      stub1.restore()
      stub2.restore()
      stub3.restore()
      stub4.restore()
      stub5.restore()
      stub6.restore()
      stub7.restore()
    }
  })

  // we do not support being invoked `tea ./script` where script has a tea shebang
  //FIXME really this is something we should support
  await runner.step("refuses tea-script as arg0", async () => {
    const f = Path.mktemp().join('foo').touch()
    const shebang_args = ['tea', 'bar']
    const stub = mock.stub(_internals, "get_shebang", () => Promise.resolve(shebang_args))
    try {
      await assertRejects(() => specimen([f.string], opts), TeaError)
    } finally {
      stub.restore()
    }
  })

  // we do not support being invoked `./script` where script has a tea shebang that doesn’t specify any pkg
  await runner.step("tea is not an interpreter", async () => {
    const f = Path.mktemp().join('foo').touch()
    const stub = mock.stub(_internals, "get_shebang", () => Promise.resolve(['tea']))
    try {
      await assertRejects(() => specimen([f.string], opts), TeaError)
    } finally {
      stub.restore()
    }
  })

  await runner.step("tea is not an interpreter", async () => {
    const f = Path.mktemp().join('foo').touch()
    const stub = mock.stub(_internals, "get_shebang", () => Promise.resolve(['tea']))
    try {
      await assertRejects(() => specimen([f.string], opts), TeaError)
    } finally {
      stub.restore()
    }
  })

  await runner.step("shebang specifies non existent pkg", async () => {
    const f = Path.mktemp().join('foo').touch()
    const stub1 = mock.stub(_internals, "get_shebang", () => Promise.resolve(['foo']))
    const stub2 = mock.stub(_internals, "which", () => Promise.resolve(undefined))
    try {
      await assertRejects(() => specimen([f.string], opts), TeaError)
    } finally {
      stub1.restore()
      stub2.restore()
    }
  })
})

function stub_execve() {
  return mock.stub(_internals, "exec", () => {
    return undefined as never  // the real function doesn’t return, but for our testing we must
  })
}
