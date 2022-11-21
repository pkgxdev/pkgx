import { assert } from "deno/testing/asserts.ts"
import { sandbox } from '../utils.ts'

Deno.test("usage", async () => {
  const out = await sandbox(({ run }) => run({args: ["--help"]}).stdout())
  assert(out.split("\n").length > 0)
})

Deno.test("+zlib.net", async () => {
  await sandbox(async tea => {
    await tea.run({
      args: ["--sync", "+zlib.net", "true"],
      net: true
    })
  })
})
