import { assert } from "deno/testing/asserts.ts"
import { shout } from '../utils.ts'

Deno.test("usage", async () => {
  const out = await shout({ tea: ["--help"] })
  assert(out.split("\n").length > 0)
})
