import { assert, assertEquals } from "deno/testing/asserts.ts"
import { describe } from "deno/testing/bdd.ts"
import { Path } from "tea"

interface This {
  tea: Path
  sandbox: Path
  TEA_PREFIX: Path
  TEA_PANTRY_PATH: Path
  TEA_CACHE_DIR: Path
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
  stderr(): Promise<string>
}

const existing_tea_prefix = Deno.env.get("CI") ? undefined : Path.home().join(".tea").isDirectory()

const suite = describe({

  name: "integration tests",

  async beforeAll(this: This) {
    const tmp = new Path(await Deno.makeTempDir({ prefix: "tea-" }))
    const cwd = new Path(new URL(import.meta.url).pathname).parent().parent()

    //TODO use deno task compile, however seems to be a bug where we cannot control the output location
    const proc = Deno.run({
      cmd: [
        "deno",
        "compile",
        "--quiet",
        "-A",
        "--unstable",
        "--output", tmp.join("tea").string,
        "src/app.ts"
      ], cwd: cwd.string
    })

    assert((await proc.status()).success)
    proc.close()

    this.tea = tmp.join("tea")
    assert(this.tea.isExecutableFile())

    this.TEA_PANTRY_PATH = (existing_tea_prefix ?? await (async () => {
      const proc = Deno.run({
        cmd: [this.tea.string, "--sync", "--silent"],
        cwd: tmp.string,
        env: { TEA_PREFIX: tmp.string },
        clearEnv: true
      })
      assert((await proc.status()).success)
      proc.close()
      return tmp
    })()).join("tea.xyz/var/pantry")

    this.TEA_CACHE_DIR = (existing_tea_prefix ?? tmp).join("tea.xyz/var/www")
  },

  async beforeEach(this: This) {
    const tmp = new Path(await Deno.makeTempDir({ prefix: "tea-" }))
    const TEA_PREFIX = existing_tea_prefix ?? tmp.join('opt').mkdir()

    this.TEA_PREFIX = TEA_PREFIX
    assert(this.TEA_PREFIX.isDirectory())

    this.sandbox = tmp.join("box").mkdir()

    const { sandbox } = this

    this.run = ({env, throws, ...opts}: RunOptions) => {
      env ??= {}
      for (const key of ['HOME', 'CI', 'RUNNER_DEBUG', 'GITHUB_ACTIONS']) {
        const value = Deno.env.get(key)
        if (value) env[key] = value
      }
      env['PATH'] = `${this.tea.parent()}:/usr/bin:/bin`  // these systems are full of junk so we prune PATH
      env['TEA_PREFIX'] ??= TEA_PREFIX.string
      env['CLICOLOR_FORCE'] = '0'
      env['TEA_PANTRY_PATH'] ??= this.TEA_PANTRY_PATH.string
      env['TEA_CACHE_DIR'] ??= this.TEA_CACHE_DIR.string

      let stdout: "piped" | undefined
      let stderr: "piped" | undefined

      // we delay instantiating the proc so we can set `stdout` if the user calls that function
      // so the contract is the user must call `stdout` within this event loop iteration
      const p = Promise.resolve().then(async () => {
        const cmd = "args" in opts
          ? [...opts.args]
          : [...opts.cmd]

        if (cmd[0] != "tea") {
          cmd.unshift(this.tea.string)
        }

        const proc = Deno.run({ cmd, cwd: sandbox.string, stdout, stderr, env, clearEnv: true})
        try {
          const status = await proc.status()
          if ((throws === undefined || throws) && !status.success) {
            if (stdout == 'piped') {
              console.error(new TextDecoder().decode(await proc.output()))
              try {
                proc.stdout?.close()
              } catch {
                // we cannot figure out how to stop this throwing if it is already closed
                // nor how to detect that
              }
            }
            if (stderr == 'piped') {
              console.error(new TextDecoder().decode(await proc.stderrOutput()))
              try {
                proc.stderr?.close()
              } catch {
                // we cannot figure out how to stop this throwing if it is already closed
                // nor how to detect that
              }
            }
            throw status
          }
          if (stdout == 'piped') {
            const out = await proc.output()
            return new TextDecoder().decode(out)
          } else if (stderr == 'piped') {
            const out = await proc.stderrOutput()
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
      p.stderr = () => {
        stderr = "piped"
        return p as unknown as Promise<string>
      }

      return p
    }
  },

  afterEach() {
    this.sandbox.parent().rm({ recursive: true })
  },

  afterAll() {
    this.tea.parent().rm({ recursive: true })
  }
})

export default suite
