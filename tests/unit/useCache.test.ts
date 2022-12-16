import { assert, assertEquals, assertFalse, assertThrows } from "deno/testing/asserts.ts"
import useCache from "hooks/useCache.ts"
import Path from "../../src/vendor/Path.ts"

Deno.test("decode", async test => {
  await test.step("std", () => {
    const stow = useCache().decode(Path.root.join("gnome.org∕glib-2.72.4+darwin+aarch64.tar.xz"))

    assertEquals(stow?.type, "bottle")
    if (stow?.type != 'bottle') throw new Error() // for type checker

    assertEquals(stow.pkg.project, "gnome.org/glib")
    assertEquals(stow.pkg.version.toString(), "2.72.4")
    assertEquals(stow.compression, 'xz')
    assertEquals(stow.host!.arch, "aarch64")
    assertEquals(stow.host!.platform, "darwin")
  })

  await test.step("openssl", () => {
    const stow = useCache().decode(Path.root.join("openssl.org-1.1.1s+darwin+aarch64.tar.xz"))

    assertEquals(stow?.type, "bottle")
    if (stow?.type != 'bottle') throw new Error() // for type checker

    assertEquals(stow.pkg.project, "openssl.org")
    assertEquals(stow.pkg.version.toString(), "1.1.1s")
    assertEquals(stow.compression, 'xz')
    assertEquals(stow.host!.arch, "aarch64")
    assertEquals(stow.host!.platform, "darwin")
  })

  await test.step("ghc", () => {
    const stow = useCache().decode(Path.root.join("haskell.org-1.2.3.4+darwin+aarch64.tar.xz"))

    assertEquals(stow?.type, "bottle")
    if (stow?.type != 'bottle') throw new Error() // for type checker

    assertEquals(stow.pkg.project, "haskell.org")
    assertEquals(stow.pkg.version.toString(), "1.2.3.4")
    assertEquals(stow.compression, 'xz')
    assertEquals(stow.host!.arch, "aarch64")
    assertEquals(stow.host!.platform, "darwin")
  })
})
