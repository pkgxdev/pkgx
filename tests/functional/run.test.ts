import { assert, assertEquals } from "deno/testing/asserts.ts"
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

  await run(["--dry-run","+kubernetes.io/kubectl"]) 

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
