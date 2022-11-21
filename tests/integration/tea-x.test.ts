import { assertEquals } from "deno/testing/asserts.ts"
import { sandbox } from '../utils.ts'

Deno.test("tea -x", async () => {
  await sandbox(async ({ run, tmpdir }) => {
    tmpdir.join("setup.py").write({ text: "print('hello')" })
    const out = await run({args: ["--sync", "setup.py"], net: true }).stdout()
    assertEquals(out, "hello\n")
  })
})
