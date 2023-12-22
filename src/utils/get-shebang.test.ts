import { assertEquals, assertRejects } from "deno/assert/mod.ts"
import specimen from "./get-shebang.ts"
import undent from "outdent"
import { Path } from "pkgx"

Deno.test("get-shebang.ts", async runner => {
  await runner.step("/usr/bin/python", async () => {
    const f = Path.mktemp().join("script").write({text: undent`
      #!/usr/bin/python
      `})
    const shebang = await specimen(f)
    assertEquals(shebang,["python"])
  })

  await runner.step("/usr/bin/env python", async () => {
    const f = Path.mktemp().join("script").write({text: undent`
      #!/usr/bin/env python
      `})
    const shebang = await specimen(f)
    assertEquals(shebang, ["python"])
  })

  await runner.step("/usr/bin/env -S python", async () => {
    const f = Path.mktemp().join("script").write({text: undent`
      #!/usr/bin/env -S python
      `})
    const shebang = await specimen(f)
    assertEquals(shebang, ["python"])
  })

  await runner.step("bin/foo", async () => {
    const f = Path.mktemp().join("script").write({text: undent`
      #!bin/foo
      `})
    await assertRejects(() => specimen(f))
  })

  await runner.step("no shebang but not empty", async () => {
    const f = Path.mktemp().join("script").write({text: undent`
      print(1)
      print(2)
      `})
    const shebang = await specimen(f)
    assertEquals(shebang, undefined)
  })

  await runner.step("empty file", async () => {
    const f = Path.mktemp().join("script").touch()
    const shebang = await specimen(f)
    assertEquals(shebang, undefined)
  })

  await runner.step({
    name: "unreadable files are ignored",
    ignore: Deno.build.os == "windows",  // dunno how to change file permissions on windows
    async fn() {
      const f = Path.mktemp().join("script").write({ text: "#!/bin/sh" }).chmod(0o000)
      const shebang = await specimen(f)
      assertEquals(shebang, undefined)
    }
  })
})
