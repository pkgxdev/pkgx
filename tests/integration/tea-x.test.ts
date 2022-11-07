import { assertEquals } from "deno/testing/asserts.ts"
import { sandbox, shout } from '../utils.ts'

Deno.test("tea -x", async () => {
  await sandbox(async tmpdir => {
    tmpdir.join("setup.py").write({ text: "print('hello')" })

    const out = await shout({ tea: ["setup.py"], cwd: tmpdir, net: true })
    assertEquals(out, "hello\n")
  })
})
