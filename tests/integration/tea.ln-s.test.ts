import { assert, assertEquals } from "deno/testing/asserts.ts"
import suite from "../integration.suite.ts"
import { it } from "deno/testing/bdd.ts"

const mk = (v = '') => {
  it(suite, `symlink: node${v}`, async function() {

    if (Deno.build.os == 'linux') {
      console.warn("skipping on linux due to deno bug")
      console.warn("https://github.com/denoland/deno/issues/17464")
      return
    }

    await this.run({args: ["--sync"]})

    const node = this.tea.ln("s", {to: this.sandbox.join(`node${v}`)})

    const proc = Deno.run({
      cmd: [`node${v}`, "--eval", "console.log('hello')"],
      stdout: "piped",
      env: {
        VERBOSE: "2",
        DEBUG: "1",
        PATH: node.parent().string
      }
    })

    try {
      const { success } = await proc.status()
      assert(success)

      const out = new TextDecoder().decode(await proc.output())
      assertEquals(out, "hello\n")
    } finally {
      proc.stdout!.close()
      proc.close()
    }
  })
}

mk()
mk("^16")
