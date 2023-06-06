import { assert, assertEquals, assertMatch } from "deno/testing/asserts.ts"
import suite from "../integration.suite.ts"
import { it } from "deno/testing/bdd.ts"
import { Path } from "tea"

async function run(cmd: string[], PATH: Path, TEA_PREFIX: Path) {
  const proc = Deno.run({
    cmd,
    stdout: "piped",
    env: {
      PATH: `${PATH}:/usr/bin:/bin`,
      TEA_PREFIX: TEA_PREFIX.string
    }
  })

  let out: string | undefined
  try {
    const { success } = await proc.status()
    out = new TextDecoder().decode(await proc.output())
    if (!success) console.error("error:", `stdout: ${out}`)
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

      const node = this.sandbox.join(`node${v}`).ln("s", {target: this.tea})
      const out = await run([`node${v}`, "--eval", "console.log('hello')"], node.parent(), this.TEA_PREFIX)
      assertEquals(out, "hello\n")
    })
  }

  // on linux symlinks are resolved by the OPERATING SYSTEM
  mk()
  mk("^16")

  it(suite, `two level symlink`, async function() {
    await this.run({args: ["--sync", "--silent"]})

    const node18 = this.sandbox.join('node^18')
      .ln("s", { target: this.tea })
    const node = this.sandbox.join('node').ln('s', { target: node18 })

    const out = await run(['node', '--version'], node.parent(), this.TEA_PREFIX)
    assertMatch(out, /v18\.\d+\.\d+/, out)
  })
}

it(suite, "symlinks to `tea` called `tea` act like tea", async function() {
  const tea = this.sandbox.join('tea').ln("s", {target: this.tea })
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

it(suite, "auto-symlinks in ~/.tea/local work", async function() {
  /// this functionality only works for properly installed tea/cli installations
  this.tea = this.tea.cp({ into: this.TEA_PREFIX.join("tea.xyz/v*/bin").mkdir('p') })
  await this.run({args: ["perl", "--version"]})

  assert(this.TEA_PREFIX.join(".local/bin/perl").isExecutableFile())
})
