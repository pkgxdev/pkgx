import { assert, assertEquals, assertMatch } from "deno/testing/asserts.ts"
import suite from "../integration.suite.ts"
import { it } from "deno/testing/bdd.ts"

it(suite, "tea --help", async function() {
  const out = await this.run({args: ["--help"]}).stdout()
  assert(out.split("\n").length > 0)
})

it(suite, "tea +zlib.net", async function() {
  const code = await this.run({ args: ["+zlib.net", "true"] })
  assertEquals(code, 0)
})

it(suite, "tea --version", async function() {
  const out = await this.run({ args: ["--version"] }).stdout()
  assertMatch(out, /tea \d+\.\d+\.\d+/)
})

it(suite, "tea /bin/ls", async function() {
  this.sandbox.join("foo").mkdir().join("bar").touch()
  const out = await this.run({ args: ["/bin/ls", "foo"] }).stdout()
  assertEquals(out, "bar\n")
})
