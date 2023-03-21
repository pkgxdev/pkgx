import { assert } from "https://deno.land/std@0.176.0/testing/asserts.ts"
import { createTestHarness } from "./testUtils.ts"

Deno.test("env", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const {run, TEA_PREFIX, getPrintedLines} = await createTestHarness()

  await run(["+kubernetes.io/kubectl"]) 

  const lines = getPrintedLines();
  assert(lines.length > 0, "lines should have printed")

  const expected = TEA_PREFIX.join("kubernetes.io")
  assert(expected.exists(), "kubernetes.io should exist")
})

Deno.test("help", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const {run, getPrintedLines} = await createTestHarness()

  await run(["--help"]) 

  const lines = getPrintedLines()
  assert(lines.length > 0, "lines should have printed")
})
