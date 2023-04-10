import { assertEquals, assertMatch, assertNotMatch } from "deno/testing/asserts.ts"
import suite from "../integration.suite.ts"
import { it } from "deno/testing/bdd.ts"

it(suite, "tea fish", async function() {
  const out = await this.run({ args: ["fish", "-c", "echo 1"]}).stdout()
  assertEquals(out, "1\n")
  assertNotMatch(out, /resolving package graph/)
})

it(suite, "tea python3.10", async function() {
  const out = await this.run({args: ["python3.10", "--version"]}).stdout()
  assertMatch(out, /Python 3\.10\.\d+/)
  assertNotMatch(out, /resolving package graph/)
})

it(suite, "tea python3.11", async function() {
  const out = await this.run({args: ["python3.11", "--version"]}).stdout()
  assertMatch(out, /Python 3\.11\.\d+/)
  assertNotMatch(out, /resolving package graph/)
})

it(suite, "tea node^16", async function() {
  const out = await this.run({args: ["node^16", "--version"]}).stdout()
  assertMatch(out, /^v16\./)
  assertNotMatch(out, /resolving package graph/)

  // run the test again to catch stderr.  stdout and stderr cannot be captured in the same run.
  // this is just to ensure that resolving messages do go to stderr
  const stderr = await this.run({args: ["node^16", "--version"]}).stderr()
  assertMatch(stderr, /resolving package graph/)
})
