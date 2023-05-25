import useConfig, { ConfigDefault } from "../../src/hooks/useConfig.ts"
import { assertEquals } from "deno/testing/asserts.ts"
import { _internals } from "tea/hooks/useConfig.ts"
import { Path, hooks } from "tea"
const { usePantry } = hooks

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

Deno.test("useConfig global state is shared across import styles", async () => {
  // testing for a bug where imports of `"tea"` and `"tea/hooks/useConfig.ts"` would
  // load their own copies of the global config object

  const tmp = new Path(await Deno.makeTempDir())
  const tea = tmp.join('tea.xyz/v0.33.2/bin').mkdir('p').join('tea').touch()

  _internals.reset()
  const defaults = ConfigDefault(undefined, tea.string, {})
  const config = useConfig(defaults)

  assertEquals(config.prefix, tmp)
  assertEquals(usePantry().prefix, tmp.join("tea.xyz/var/pantry/projects"))
})
