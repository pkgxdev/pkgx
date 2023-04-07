import Path from "path"
import PathUtils from "path-utils"
import { assertArrayIncludes, assertEquals } from "deno/testing/asserts.ts"

Deno.test("test PathUtils", async test => {
  await test.step("modify $PATH", () => {
    const envPath = PathUtils.envPath()

    assertArrayIncludes(envPath, [Path.root.join("usr/bin")])

    const a = Path.home().join("tmp/bin")
    const b = PathUtils.addPath(a)
    assertArrayIncludes(b, [a])

    const c = PathUtils.envPath()
    assertArrayIncludes(c, [a])

    const d = PathUtils.rmPath(a)
    assertEquals(d, envPath)

    const e = PathUtils.envPath()
    assertEquals(e, envPath)
  })

  await test.step("search $PATH", () => {
    const usrBin = Path.root.join("usr/bin")
    const bin = Path.root.join("bin")
    const sbin = Path.root.join("sbin")
    const envPath = PathUtils.envPath()

    assertArrayIncludes(envPath, [usrBin])

    const a = PathUtils.findBinary("env", envPath)
    assertEquals(a, usrBin.join("env"))

    const b = PathUtils.findBinary("env")
    assertEquals(b, usrBin.join("env"))

    const c = PathUtils.findBinary("bloogargle", envPath)
    assertEquals(c, undefined)

    const d = PathUtils.findBinary("ls", [bin])
    assertEquals(d, bin.join("ls"))

    const e = PathUtils.findBinary("ls", [sbin])
    assertEquals(e, undefined)
  })
})
