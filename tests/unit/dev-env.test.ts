import { assertEquals } from "deno/testing/asserts.ts"
import { usePackageYAMLFrontMatter } from "hooks"
import { refineFrontMatter } from "hooks/usePackageYAML.ts"

//FIXME would be better off as integration tests
// my bad. I was halfway through and couldn't be bothered to switch

const fixtures_d = new URL(import.meta.url).path().parent().join('fixtures')

Deno.test("dev-envs", async test => {
  await test.step("go.mod", async () => {
    const foo = await usePackageYAMLFrontMatter(fixtures_d.join('go.mod'))
    assertEquals(foo?.pkgs[0]?.project, 'zlib.net')
  })

  for (const filename of ['cargo.toml', 'pyproject.toml']) {
    await test.step(filename, async () => {
      const foo = await usePackageYAMLFrontMatter(fixtures_d.join(filename))
      assertEquals(foo?.pkgs[0]?.project, 'zlib.net')
    })
  }

  for (const filename of ['package.json', 'deno.json', 'deno.jsonc']) {
    await test.step(filename, async () => {
      const txt = await fixtures_d.join(filename).read()
      const json = JSON.parse(txt)
      const foo = await refineFrontMatter(json?.tea)
      assertEquals(foo?.pkgs[0]?.project, 'zlib.net')
    })
  }

  await test.step("tea.yaml", async () => {
    const foo = refineFrontMatter(await await fixtures_d.join("tea.yaml").readYAML())
    assertEquals(foo?.pkgs[0]?.project, 'zlib.net')
  })
})
