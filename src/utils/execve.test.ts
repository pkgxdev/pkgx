import { assertThrows } from "deno/assert/assert_throws.ts"
import execve, { _internals } from "./execve.ts"
import faker, { faker_args } from "./test-utils.ts"
import * as mock from "deno/testing/mock.ts"
import { Path } from "pkgx"

Deno.test({
  name: "execve.ts",
  ignore: Deno.build.os == "windows",  // windows has no equivalent to execve
  async fn(runner) {
    await runner.step("happy path", () => {
      const stub = mock.stub(_internals, "execve", () => { return 0 })
      try {
        assertThrows(
          () => execve({ cmd: faker_args(), env: {} }),
          "execve (0)"
          )
      } finally {
        stub.restore()
      }
    })

    await runner.step("relative path", () => {
      const stub = mock.stub(_internals, "execve", () => { return 0 })
      try {
        assertThrows(
          () => execve({ cmd: ["./ls"], env: {} }),
          "execve (0)"
          )
      } finally {
        stub.restore()
      }
    })

    await runner.step("PATH parser", async () => {
      const stub = mock.stub(_internals, "execve", () => { return 0 })
      const file = new Path(await Deno.makeTempFile()).chmod(0o700)
      try {
        assertThrows(
          () => execve({ cmd: [file.basename()], env: {PATH: `.:~:~/foo:${file.parent()}`, "HOME": "/home/test"} }),
          "execve (0)"
          )
      } finally {
        file.rm()
        stub.restore()
      }
    })


    await runner.step("file doesn’t exist", () => {
      assertThrows(
        () => execve({ cmd: faker_args(), env: {} }),
        Deno.errors.NotFound
      )
    })

    await runner.step("file is not executable", () => {
      const args = faker_args()
      const f = Path.mktemp().join(args[0]).touch()
      args[0] = f.string

      assertThrows(
        () => execve({ cmd: args, env: {} }),
        Deno.errors.PermissionDenied
      )
    })

    await runner.step("no working directory", () => {
      const stub = mock.stub(_internals, "getcwd", () => { throw new Error() })
      try {
        assertThrows(() => execve({ cmd: ["foo", ...faker_args()], env: {} }))
      } finally {
        stub.restore()
      }
    })

    const thisfile = new Path(new URL(import.meta.url).pathname)

    await runner.step("file exists but is not executable", () => {
      const cmd = [thisfile.string, ...faker_args()]
        assertThrows(
          () => execve({ cmd, env: {} }),
          Deno.errors.PermissionDenied
          )
    })

    await runner.step("file exists but is a directory", () => {
      const cmd = [thisfile.parent().string, ...faker_args()]
        assertThrows(
          () => execve({ cmd, env: {} }),
          Deno.errors.PermissionDenied
          )
    })

    await runner.step("ENAMETOOLONG", () => {
      const cmd = [faker.string.alphanumeric({length: 1024*5})]
        assertThrows(
          () => execve({ cmd, env: {} }),
          "execve (63)"
          )
    })
  }
})
