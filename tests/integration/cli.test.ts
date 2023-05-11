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

it(suite, "tea +zlib.net --json", async function() {
  const code = await this.run({ args: ["--json", "+zlib.net", "true"] })
  assertEquals(code, 0)
})

it(suite, "`tea +foo.com --json` errors neatly", async function() {
  const code = await this.run({ args: ["--json", "+foo.com", "true"], throws: false })
  assertEquals(code, 7)
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

it(suite, "tea chalk --version (via npx provider)", async function() {
  await this.run({ args: ["chalk", "--version"] })
})

it(suite, "tea http-server --help (via npx provider)", async function() {
  await this.run({ args: ["http-server", "--help"] })
})

it(suite, "tea pkg --version", async function() {
  await this.run({ args: ["pkg", "--version"] })
})
