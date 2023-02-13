import { assertEquals } from "deno/testing/asserts.ts"
import suite from "../integration.suite.ts"
import { it } from "deno/testing/bdd.ts"

it(suite, "TEA_PREFIX is set", async function() {
  const out = await this.run({args: ["sh", "-c", "echo $TEA_PREFIX"]}).stdout()
  assertEquals(out, this.TEA_PREFIX + "\n")
})

//TODO need to test without TEA_PREFIX set
