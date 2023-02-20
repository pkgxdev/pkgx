import { assert, assertEquals, assertMatch } from "deno/testing/asserts.ts"
import suite from "../integration.suite.ts"
import { it } from "deno/testing/bdd.ts"
import Path from "path"

// temporary until node bottles are not crashing on macOS again
if (Deno.build.os != 'darwin' || !Deno.env.get("GITHUB_ACTIONS")) {

async function run(cmd: string[], PATH: Path, TEA_PREFIX: Path) {
  const proc = Deno.run({
    cmd,
    stdout: "piped",
    env: {
      PATH: PATH.string,
      TEA_PREFIX: TEA_PREFIX.string
    }
  })

  let out: string | undefined
  try {
    const { success } = await proc.status()
    out = new TextDecoder().decode(await proc.output())
    if (!success) console.error("error:", `stdout: out`)
    assert(success, out)
  } finally {
    if (out === undefined) proc.stdout!.close()
    proc.close()
  }

  return out
}

if (Deno.build.os != 'linux') {
  const mk = (v = '') => {
    it(suite, `symlink: node${v}`, async function() {
      await this.run({args: ["--sync", "--silent"]})

      const node = this.tea.ln("s", {to: this.sandbox.join(`node${v}`)})
      const out = await run([`node${v}`, "--eval", "console.log('hello')"], node.parent(), this.TEA_PREFIX)
      assertEquals(out, "hello\n")
    })
  }

  // on linux symlinks are resolved by the OPERATING SYSTEM
  mk()
  mk("^16")

  it(suite, `two level symlink`, async function() {
    await this.run({args: ["--sync", "--silent"]})

    const node = this.tea
      .ln('s', {to: this.sandbox.join('node^18')})
      .ln('s', {to: this.sandbox.join('node')})

    const out = await run(['node', '--version'], node.parent(), this.TEA_PREFIX)
    assertMatch(out, /v18\.\d+\.\d+/, out)
  })
}

it(suite, "symlinks to `tea` called `tea` act like tea", async function() {
  const tea = this.tea.ln("s", {to: this.sandbox.join('tea')})
  const out = await run(['tea', '--version'], tea.parent(), Path.root)
  assertMatch(out, /tea \d+\.\d+\.\d+/)
})

it(suite, "hardlinks work", async function() {
  const node = this.sandbox.join('node')
  await Deno.link(this.tea.string, node.string)

  await this.run({args: ["--sync", "--silent"]})

  const out = await run(['node', "--eval", "console.log('hello')"], node.parent(), this.TEA_PREFIX)
  assertEquals(out, "hello\n", out)
})

}