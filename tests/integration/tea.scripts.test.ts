import { assertEquals } from "deno/testing/asserts.ts"
import { undent } from "../../src/utils/index.ts"
import suite from "../integration.suite.ts"
import { it } from "deno/testing/bdd.ts"

it(suite, "tea fixture.py", async function() {
  this.sandbox.join("fixture.py").write({ text: "print('hello')" })
  const out = await this.run({args: ["fixture.py"]}).stdout()
  assertEquals(out, "hello\n")
})

it(suite, "shebang without args", async function() {
  const fixture = this.sandbox.join("fixture.py").write({ text: undent`
    #!/usr/bin/env python3
    import platform
    print(platform.python_version())
    `
  }).chmod(0o500)
  const out = await this.run({args: [fixture.string]}).stdout()
  assertEquals(out[0], "3")  //TODO better
})

it(suite, "shebang with args", async function() {
  const fuzz = "hi"
  const fixture = this.sandbox.join("fixture.sh").write({ text: undent`
    #!/bin/bash

    #---
    # args: [sh]
    #---

    echo "${fuzz}"
    `
  }).chmod(0o500)
  const out = await this.run({args: [fixture.string]}).stdout()
  assertEquals(out.trim(), fuzz)
})

it(suite, "tea shebang", async function() {
  const fuzz = "hi"
  const fixture = this.sandbox.join("fixture.sh").write({ text: undent`
    #!/usr/bin/env fish

    echo "${fuzz}"
    `
  }).chmod(0o500)
  const out = await this.run({args: [fixture.string]}).stdout()
  assertEquals(out.trim(), fuzz)
})
