import { run } from "../../src/app.main.ts"
import { useArgs } from "hooks/useFlags.ts"
import { assert } from "https://deno.land/std@0.176.0/testing/asserts.ts"
import { createTestHarness } from "./testUtils.ts"

Deno.test("env", { sanitizeResources: false, sanitizeOps: false }, async () => {
    const {teaDir, TEA_PREFIX, getPrintedLines} = await createTestHarness()

    const [args] = useArgs(["+kubernetes.io/kubectl"], teaDir.string)
    await run(args) 

    const lines = getPrintedLines();
    assert(lines.length > 0, "lines should have printed")

    const expected = TEA_PREFIX.join("kubernetes.io")
    assert(expected.exists(), "kubernetes.io should exist")
})

Deno.test("help", { sanitizeResources: false, sanitizeOps: false }, async () => {
    const {teaDir, getPrintedLines} = await createTestHarness()

    const [args] = useArgs(["--help"], teaDir.string)
    await run(args) 

    const lines = getPrintedLines()
    assert(lines.length > 0, "lines should have printed")
})
