import { describe } from "deno/testing/bdd.ts"
import { assert } from "deno/testing/asserts.ts"
import SemVer from "semver"
import Path from "path"
import { panic } from "../src/utils/safe-utils.ts";

interface This {
  tea: Path
  sandbox: Path
  TEA_PREFIX: Path
  run: (opts: RunOptions) => Promise<number> & Enhancements
}

type RunOptions = ({
  args: string[]
} | {
  cmd: string[]
}) & {
  env?: Record<string, string>
  throws?: boolean
}

interface Enhancements {
  stdout(): Promise<string>
}

const existing_tea_prefix = Deno.env.get("CI") ? undefined : Path.home().join(".tea").isDirectory()

const suite = describe({
  name: "integration tests",
  async beforeEach(this: This) {
    const v = new SemVer(Deno.env.get("VERSION") ?? "1.2.3")
    const tmp = new Path(await Deno.makeTempDir({ prefix: "tea" }))
    const cwd = new URL(import.meta.url).path().parent().parent().string
    const TEA_PREFIX = existing_tea_prefix ?? tmp.join('opt')
    const bin = tmp.join('bin').mkpath()

    const proc = Deno.run({
      cmd: [
        "deno",
        "compile",
        "--quiet",
        "--allow-read",    // restricting reads would be nice but Deno.symlink requires read permission to ALL
        "--allow-write",   // restricting writes would be nice but Deno.symlink requires write permission to ALL
        "--allow-net",
        "--allow-run",
        "--allow-env",
        "--unstable",
        "--output", bin.join("tea").string,
        "src/app.ts"
      ], cwd
    })

    assert((await proc.status()).success)
    proc.close()

    this.tea = bin.join("tea")
    assert(this.tea.isExecutableFile())

    this.TEA_PREFIX = TEA_PREFIX
    assert(this.TEA_PREFIX.isDirectory())

    this.sandbox = tmp.join("box").mkdir()

    const teafile = bin.join('tea')
    const { sandbox } = this

    this.run = ({env, throws, ...opts}: RunOptions) => {
      env ??= {}
      for (const key of ['HOME', 'CI', 'RUNNER_DEBUG', 'GITHUB_ACTIONS']) {
        const value = Deno.env.get(key)
        if (value) env[key] = value
      }
      env['PATH'] = `${bin}:/usr/bin:/bin`  // these systems are full of junk so we prune PATH
      env['TEA_PREFIX'] = TEA_PREFIX.string
      env['CLICOLOR_FORCE'] = '1'

      let stdout: "piped" | undefined

      // we delay instantiating the proc so we can set `stdout` if the user calls that function
      // so the contract is the user must call `stdout` within this event loop iteration
      const p = Promise.resolve().then(async () => {
        const cmd = "args" in opts
          ? [...opts.args]
          : [...opts.cmd]

        // be faster when testing locally
        if ("args" in opts) {
          cmd.unshift(teafile.string)
          if (!existing_tea_prefix) {
            cmd.unshift(teafile.string, "--sync")
          }
        }

        const proc = Deno.run({ cmd, cwd: sandbox.string, stdout, env, clearEnv: true})
        try {
          const status = await proc.status()
          if ((throws === undefined || throws) && !status.success) {
            if (stdout == 'piped') proc.stdout?.close()
            throw status
          }
          if (stdout == 'piped') {
            const out = await proc.output()
            return new TextDecoder().decode(out)
          } else {
            return status.code
          }
        } finally {
          proc.close()
        }
      }) as Promise<number> & Enhancements

      p.stdout = () => {
        stdout = "piped"
        return p as unknown as Promise<string>
      }

      return p
    }
  },
  afterEach() {
    // this.TEA_PREFIX.parent().rm({ recursive: true })
  },
})

export default suite
