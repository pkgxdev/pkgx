import { assert, assertEquals, assertMatch, assertRejects } from "deno/testing/asserts.ts"
import suite from "../integration.suite.ts"
import { it } from "deno/testing/bdd.ts"
import undent from "outdent"

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
  assertEquals(code, 1)
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

it(suite, "tea determines its own prefix and pantry works", async function() {
  // this verifies that useConfig() works as expected even though seemingly
  // deno loads separate copies of libtea for each of the import map methods we use
  // history: there was a bug where libtea internally had a different config object than tea/cli
  // testing the pantry works properly verifies that this is no longer the case

  this.tea = this.tea.mv({ into: this.TEA_PREFIX.join("tea.xyz/v0.33.2/bin").mkdir('p') })

  this.TEA_PREFIX
    .join("tea.xyz/var/pantry/projects/foo.com").mkdir('p')
    .join("package.yml").write({ text: undent`
      provides: [bin/foo]
      `})

  const stdout = await this.run({ args: ["--prefix"], env: { TEA_PREFIX: null, TEA_PANTRY_PATH: null } }).stdout()
  assertEquals(stdout.trim(), this.TEA_PREFIX.string)

  await this.run({ args: ["--provides", "foo"], env: { TEA_PREFIX: null, TEA_PANTRY_PATH: null } })
})
