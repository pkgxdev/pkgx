import { assertEquals, assertMatch } from "deno/testing/asserts.ts"
import { sandbox } from '../utils.ts'

//TODO verify that python version is actually what we request

Deno.test("tea -X python", async () => {
  await sandbox(async ({ run }) => {
    const out = await run({args: ["-SX", "python", "-c", "print(1)"], net: true }).stdout()
    assertEquals(out, "1\n")
  })
})

Deno.test("tea -SX python3", async () => {
  await sandbox(async ({ run }) => {
    const out = await run({args: ["-SX", "python3", "-c", "print(2)"], net: true }).stdout()
    assertEquals(out, "2\n")
  })
})

Deno.test("tea -SX python3.11", async () => {
  await sandbox(async ({ run }) => {
    const out = await run({args: ["-SX", "python3.11", "-c", "print(3)"], net: true }).stdout()
    assertEquals(out, "3\n")
  })
})

Deno.test("tea -SX node^16", async () => {
  await sandbox(async ({ run }) => {
    const out = await run({args: ["-SX", "node^16", "--version"], net: true }).stdout()
    assertMatch(out, /^v16\./)
  })
})
