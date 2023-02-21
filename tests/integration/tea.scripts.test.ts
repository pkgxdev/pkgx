import { assertEquals } from "deno/testing/asserts.ts"
import { undent } from "../../src/utils/index.ts"
import suite from "../integration.suite.ts"
import { it } from "deno/testing/bdd.ts"

//TODO pick things macOS doesn’t have, eg. php
//TODO don’t use deno *we use deno lol* so it will be available perhaps accidentally

it(suite, "`tea foo.py`", async function() {
  this.sandbox.join("fixture.py").write({ text: "print('hello')" })
  const out = await this.run({args: ["fixture.py"]}).stdout()
  assertEquals(out, "hello\n")
})

it(suite, "`tea foo` with env shebang", async function() {
  const fixture = this.sandbox.join("fixture.py").write({ text: undent`
    #!/usr/bin/env python3.10
    import platform
    print(platform.python_version())
    `
  })
  const out = await this.run({args: [fixture.string]}).stdout()
  assertEquals(out[0], "3")  //TODO better
})

it(suite, "`tea foo` with shebang", async function() {
  const fixture = this.sandbox.join("fixture.py").write({ text: undent`
    #!/usr/bin/python3.10
    import platform
    print(platform.python_version())
    `
  })
  const out = await this.run({args: [fixture.string]}).stdout()
  assertEquals(out[0], "3")  //TODO better
})

it(suite, "tea env shebang with args", async function() {
  const fuzz = "hi"
  const fixture = this.sandbox.join("fixture.sh").write({ text: undent`
    #!/usr/bin/env tea

    /*---
     args: [deno, run, --allow-read]
    ---*/

    Deno.readTextFileSync("fixture.sh")

    console.log('${fuzz}')
    `
  }).chmod(0o500)
  let out = await this.run({args: [fixture.string]}).stdout()
  assertEquals(out.trim(), fuzz)

  out = await this.run({cmd: [fixture.string]}).stdout()
  assertEquals(out.trim(), fuzz)
})

it(suite, "tea env shebang with args in the shebang", async function() {
  const fuzz = "hi"
  const fixture = this.sandbox.join("fixture.sh").write({ text: undent`
    #!/usr/bin/env -S tea fish

    echo "${fuzz}"
    `
  }).chmod(0o500)
  let out = await this.run({cmd: [fixture.string]}).stdout()
  assertEquals(out.trim(), fuzz)

  out = await this.run({args: [fixture.string]}).stdout()
  assertEquals(out.trim(), fuzz)
})

if (Deno.build.os == "darwin") {
  // darwin env doesn’t need `-S` so we support it only there
  it(suite, "tea env shebang with args in the shebang without the -S", async function() {
    const fuzz = "hi"
    const fixture = this.sandbox.join("fixture.sh").write({ text: undent`
      #!/usr/bin/env tea fish

      echo "${fuzz}"
      `
    }).chmod(0o500)

    let out = await this.run({cmd: [fixture.string]}).stdout()
    assertEquals(out.trim(), fuzz)

    out = await this.run({args: [fixture.string]}).stdout()
    assertEquals(out.trim(), fuzz)
  })
}

it(suite, "shebang with args in the shebang line", async function() {
  const fuzz = "hi"
  const fixture = this.sandbox.join("fixture.sh").write({ text: undent`
    #!/usr/bin/deno run --allow-read

    Deno.readTextFileSync("fixture.sh")

    console.log('${fuzz}')
    `
  })
  const out = await this.run({args: [fixture.string]}).stdout()
  assertEquals(out.trim(), fuzz)
})

it(suite, "env shebang with args in the shebang line", async function() {
  const fuzz = "hi"
  const fixture = this.sandbox.join("fixture.sh").write({ text: undent`
    #!/usr/bin/env -S deno run --allow-read

    Deno.readTextFileSync("fixture.sh")

    console.log('${fuzz}')
    `
  })
  const out = await this.run({args: [fixture.string]}).stdout()
  assertEquals(out.trim(), fuzz)
})

it(suite, "env shebang with args in the shebang line without the -S executing via `tea` rather than the shell", async function() {
  const fuzz = "hi"
  const fixture = this.sandbox.join("fixture.sh").write({ text: undent`
    #!/usr/bin/env deno run --allow-read

    Deno.readTextFileSync("fixture.sh")

    console.log('${fuzz}')
    `
  })
  const out = await this.run({args: [fixture.string]}).stdout()
  assertEquals(out.trim(), fuzz)
})

it(suite, "env shebang with args in both places", async function() {
  const fuzz = "hi"
  const fixture = this.sandbox.join("fixture.sh").write({ text: undent`
    #!/usr/bin/env -S deno run

    /*---
     args: [--allow-read]
    ---*/

    Deno.readTextFileSync("fixture.sh")

    console.log('${fuzz}')
    `
  })
  const out = await this.run({args: [fixture.string]}).stdout()
  assertEquals(out.trim(), fuzz)
})

it(suite, "deno shebang with args in both places", async function() {
  const fuzz = "hi"
  const fixture = this.sandbox.join("fixture.sh").write({ text: undent`
    #!/usr/bin/deno run

    /*---
     args: [--allow-read]
    ---*/

    Deno.readTextFileSync("fixture.sh")

    console.log('${fuzz}')
    `
  })
  const out = await this.run({args: [fixture.string]}).stdout()
  assertEquals(out.trim(), fuzz)
})

it(suite, "tea shebang with YAML args", async function() {
  const fuzz = "hi"

  const fixture = this.sandbox.join("fixture.sh").write({ text: undent`
    #!/usr/bin/env -S tea

    /*---
     args: [deno, run, --allow-read]
    ---*/

    Deno.readTextFileSync("fixture.sh")

    console.log('${fuzz}')
    `
  }).chmod(0o500)
  const out = await this.run({cmd: [fixture.string]}).stdout()
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

it(suite, "tea shebang but executed via tea interprets shebang", async function() {
  const fuzz = "hi"

  const fixture = this.sandbox.join("fixture.sh").write({ text: undent`
    #!/usr/bin/env -S tea node

    console.log('${fuzz}')
    `
  }).chmod(0o500)
  const out = await this.run({args: [fixture.string]}).stdout()
  assertEquals(out.trim(), fuzz)
})
