import { assertEquals, assertMatch } from "deno/testing/asserts.ts"
import suite from "../integration.suite.ts"
import { it } from "deno/testing/bdd.ts"

it(suite, "tea node", async function() {
  const out = await this.run({ args: ["node", "--eval", "console.log(1)"]}).stdout()
  assertEquals(out, "1\n")
})

it(suite, "tea python3.10", async function() {
  const out = await this.run({args: ["python3.10", "--version"]}).stdout()
  assertMatch(out, /Python 3\.10\.\d+/)
})

it(suite, "tea python3.11", async function() {
  const out = await this.run({args: ["python3.11", "--version"]}).stdout()
  assertMatch(out, /Python 3\.11\.\d+/)
})

it(suite, "tea node^16", async function() {
  const out = await this.run({args: ["node^16", "--version"]}).stdout()
  assertMatch(out, /^v16\./)
})
