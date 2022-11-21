import { assert } from "deno/testing/asserts.ts"
import { backticks, system, sandbox } from '../utils.ts'

Deno.test("usage", async () => {
  const out = await backticks({ tea: ["--help"] })
  assert(out.split("\n").length > 0)
})

Deno.test("+zlib.net", async () => {
  await sandbox(async (tmpdir) => {
    await system({
      tea: ["--sync", "+zlib.net", "true"],
      net: true,
      env: {"TEA_PREFIX": tmpdir.string},
      cwd: tmpdir
    })
  })
})
