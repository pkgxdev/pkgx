import useConfig, { ConfigDefault } from "../../src/hooks/useConfig.ts"
import { assertEquals } from "deno/testing/asserts.ts"
import { _internals } from "tea/hooks/useConfig.ts"
import { Path } from "tea"

Deno.test("prefix discovery", async () => {
  const tmp = new Path(await Deno.makeTempDir())
  const tea = tmp.join("tea.xyz/v1.2.3/bin").mkdir('p').join("tea").touch()
  const config = ConfigDefault(undefined, tea.string, {})
  assertEquals(config.prefix, tmp)
})

Deno.test("prefix discovery via versioned symlink", async () => {
  const tmp = new Path(await Deno.makeTempDir())
  const shelf = tmp.join("tea.xyz")
  const keg = shelf.join("v1.2.3")

  keg.join("bin").mkdir('p').join("tea").touch()

  const v1 = shelf.join("v1").ln('s', { target: keg })
  const config = ConfigDefault(undefined, v1.join('bin/tea').string, {})
  assertEquals(config.prefix, tmp)
})

Deno.test("prefix discovery via separate symlink", async () => {
  const tmp = new Path(await Deno.makeTempDir())
  const tea = tmp.join('tea').ln('s', { target: tmp.join("tea.xyz/v1.2.3/bin").mkdir('p').join("tea").touch() })

  const config = ConfigDefault(undefined, tea.string, {})
  assertEquals(config.prefix, tmp)
})

Deno.test("prefix discovery defaults to ~/.tea", async () => {
  const tmp = new Path(await Deno.makeTempDir())
  const tea = tmp.join('tea').touch()

  const config = ConfigDefault(undefined, tea.string, {})
  assertEquals(config.prefix, Path.home().join(".tea"))
})
