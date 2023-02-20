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
  })
  const out = await this.run({args: [fixture.string]}).stdout()
  assertEquals(out[0], "3")  //TODO better
})

it(suite, "no shebang", async function() {
  const fixture = this.sandbox.join("fixture.ts").write({ text: undent`
    console.log("hi")
    `
  })
  const out = await this.run({args: [fixture.string]}).stdout()
  assertEquals(out, "hi\n")  //TODO better
})

it(suite, "shebang with args", async function() {
  const fuzz = "hi"
  const fixture = this.sandbox.join("fixture.sh").write({ text: undent`
    #!/usr/bin/env deno

    /*---
     args: [deno, run, --allow-read]
    ---*/

    Deno.readTextFileSync("fixture.sh")

    console.log('${fuzz}')
    `
  })
  const out = await this.run({args: [fixture.string]}).stdout()
  assertEquals(out.trim(), fuzz)
})

it(suite, "tea shebang", async function() {
  const fuzz = "hi"
  const fixture = this.sandbox.join("fixture.sh").write({ text: undent`
    #!/usr/bin/env -S tea fish

    echo "${fuzz}"
    `
  }).chmod(0o500)
  const out = await this.run({cmd: [fixture.string]}).stdout()
  assertEquals(out.trim(), fuzz)
})

it(suite, "tea shebang with args", async function() {
  const fuzz = "hi"
  const fixture = this.sandbox.join("fixture.sh").write({ text: undent`
    #!/usr/bin/env -S tea

    /*---
     args: [deno, run, --allow-read]
    ---*/

    Deno.readTextFileSync("fixture.sh")

    console.log('${fuzz}')
    `
  })
  const out = await this.run({args: [fixture.string]}).stdout()
  assertEquals(out.trim(), fuzz)
})

it(suite, "tea shebang with args in both places", async function() {
  const fuzz = "hi"
  const fixture = this.sandbox.join("fixture.sh").write({ text: undent`
    #!/usr/bin/env -S tea deno run

    /*---
     args: [deno, run, --allow-read]
    ---*/

    Deno.readTextFileSync("fixture.sh")

    console.log('${fuzz}')
    `
  })
  const out = await this.run({args: [fixture.string]}).stdout()
  assertEquals(out.trim(), fuzz)
})

it(suite, "tea script that tea doesn’t know what to do with errors cleanly", async function() {
  const fixture = this.sandbox.join("fixture.txt").write({ text: undent`
    #!/usr/bin/env tea

    exit 12  # won’t run
    `
  }).chmod(0o500)
  const out = await this.run({args: [fixture.string], throws: false})
  assertEquals(out, 103)
})
