import { assert, assertEquals, assertRejects, assertArrayIncludes } from "deno/testing/asserts.ts"
import { createTestHarness } from "./testUtils.ts"

Deno.test("env", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const {run, TEA_PREFIX } = await createTestHarness()

  const { stdout } = await run(["+kubernetes.io/kubectl"])

  assert(stdout.length > 0, "lines should have printed")

  const expected = TEA_PREFIX.join("kubernetes.io")
  assert(expected.exists(), "kubernetes.io should exist")
})

Deno.test("dry-run", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const {run, TEA_PREFIX } = await createTestHarness()

  await run(["--dry-run", "+kubernetes.io/kubectl", "foo", "bar"])

  // TODO: try to capture "imagined text"

  const expected = TEA_PREFIX.join("kubernetes.io")
  assert(!expected.exists(), "kubernetes.io should not exist for dry run")
})

Deno.test("prefix", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const {run, TEA_PREFIX } = await createTestHarness()

  const { stdout } = await run(["--prefix"])

  assert(stdout.length > 0, "lines should have printed")
  assertEquals(stdout[0], TEA_PREFIX.string)
})

Deno.test("version", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const { run } = await createTestHarness()

  const { stdout } = await run(["--version"])

  assert(stdout.length > 0, "lines should have printed")
  assert(stdout[0].startsWith("tea"))
})

Deno.test("complete node", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const {run } = await createTestHarness()

  const { stdout } = await run(["--complete", "node"])

  assert(stdout.length > 0, "lines should have printed")
  assertArrayIncludes(stdout[0].split("\n"), ["node"])
})

Deno.test("complete no", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const {run } = await createTestHarness()

  const { stdout } = await run(["--complete", "no"])

  assert(stdout.length > 0, "lines should have printed")
  assertArrayIncludes(stdout[0].split("\n"), ["node", "nohup"])
})

Deno.test("complete brazzorsks", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const {run } = await createTestHarness()

  const { stdout } = await run(["--complete", "brazzorsks"])

  assert(stdout.length == 0, "no lines should have printed")
})

Deno.test("help", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const { run } = await createTestHarness()
  const { stdout } = await run(["--help"])

  assert(stdout.length > 0, "lines should have printed")
  assert(!stdout[0].includes("alt. modes:"))
  assert(!stdout[0].includes("ideology:"))
})

Deno.test("help verbose", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const { run } = await createTestHarness()
  const { stdout } = await run(["--verbose", "--help"])

  assert(stdout.length > 0, "lines should have printed")
  assert(stdout[0].includes("alt. modes:"))
  assert(stdout[0].includes("ideology:"))
})

Deno.test("tea +zlib.net --json", async () => {
  const { run } = await createTestHarness()
  await run(["--json", "+zlib.net"])
})

Deno.test("`tea +foo.com --json` errors neatly", async function() {
  const { run } = await createTestHarness()
  assertRejects(() => run(["--json", "+foo.com"]))
})

Deno.test("tea +zlib.net --verbose", async () => {
  const { run } = await createTestHarness()
  await run(["--verbose", "+zlib.net"])
})

Deno.test("tea +zlib.net --cd /tmp", async () => {
  const { run } = await createTestHarness()
  await run(["--cd", "/tmp", "+zlib.net"])
})

Deno.test("tea --env --keep-going", async () => {
  const { run } = await createTestHarness()
  await run(["--env", "--keep-going"])
})

Deno.test("usage error", async () => {
  const { run } = await createTestHarness()
  assertRejects(() => run(["--invalid-option"]))
})

Deno.test("tea commands", async () => {
  const { run } = await createTestHarness()
  await run(["pkg", "query", "--prefix", "zlib.net=1"])
})
