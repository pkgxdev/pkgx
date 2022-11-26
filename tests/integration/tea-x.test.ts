import { assertEquals } from "deno/testing/asserts.ts"
import { undent } from "../../src/utils/index.ts";
import { sandbox } from '../utils.ts'

Deno.test("tea -x", async () => {
  await sandbox(async ({ run, tmpdir }) => {
    tmpdir.join("fixture.py").write({ text: "print('hello')" })
    const out = await run({args: ["--sync", "fixture.py"], net: true }).stdout()
    assertEquals(out, "hello\n")
  })

  await sandbox(async ({ run, tmpdir }) => {
    tmpdir.join("fixture.ts").write({ text: "console.log('hello')" })
    const out = await run({args: ["--sync", "fixture.ts"], net: true }).stdout()
    assertEquals(out, "hello\n")
  })
})

Deno.test("shebangs", async harness => {
  await harness.step("without args", async () => {
    await sandbox(async ({ run, tmpdir }) => {
      const fixture = tmpdir.join("fixture.py").write({ text: undent`
        #!/usr/bin/env python3
        import platform
        print(platform.python_version())
        `
      }).chmod(0o500)
      const out = await run({args: ["--sync", fixture.string], net: true }).stdout()
      assertEquals(out[0], "3")  //TODO better
    })
  })

  // verifies that we run `sh fixture.sh` and not `bash sh fixture.sh`
  await harness.step("with args", async () => {
    await sandbox(async ({ run, tmpdir }) => {
      const fuzz = "hi"
      const fixture = tmpdir.join("fixture.sh").write({ text: undent`
        #!/bin/bash

        #---
        # args: [sh]
        #---

        echo "${fuzz}"
        `
      }).chmod(0o500)
      const out = await run({args: ["--sync", fixture.string], net: true}).stdout()
      assertEquals(out.trim(), fuzz)
    })
  })
})
