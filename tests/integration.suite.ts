import { describe } from "deno/testing/bdd.ts"
import { assert } from "deno/testing/asserts.ts"
import SemVer from "semver"
import Path from "path"

interface This {
  tea: Path
  sandbox: Path
  TEA_PREFIX: Path
  run: (opts: RunOptions) => Promise<number> & Enhancements
}

interface RunOptions {
  args: string[]
  env?: Record<string, string>
  throws?: boolean
}

interface Enhancements {
  stdout(): Promise<string>
}

const existing_www_cache = Path.home().join(".tea/tea.xyz/var/www")

const suite = describe({
  name: "integration tests",
  async beforeEach(this: This) {
    const v = new SemVer(Deno.env.get("VERSION") ?? "1.2.3")
    const tmp = new Path(await Deno.makeTempDir({ prefix: "tea" }))
    const cwd = new URL(import.meta.url).path().parent().parent().string
    const bin = tmp.join(`opt/tea.xyz/v${v}/bin`).mkpath()

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

    this.TEA_PREFIX = tmp.join("opt")
    assert(this.TEA_PREFIX.isDirectory())

    this.sandbox = tmp.join("box").mkdir()

    const teafile = bin.join('tea')
    const { sandbox, TEA_PREFIX } = this

    if (existing_www_cache.isDirectory()) {
      // we're not testing our ISP
      const to = this.TEA_PREFIX.join("tea.xyz/var").mkpath().join("www")
      existing_www_cache.ln('s', {to})
    }

    this.run = ({args, env, throws}: RunOptions) => {
      const cmd = [teafile.string, ...args]

      env ??= {}
      for (const key of ['HOME', 'CI', 'RUNNER_DEBUG', 'GITHUB_ACTIONS']) {
        const value = Deno.env.get(key)
        if (value) env[key] = value
      }
      env['PATH'] = "/usr/bin:/bin"  // these systems are full of junk
      env['TEA_PREFIX'] = TEA_PREFIX.string

      let stdout: "piped" | undefined

      // we delay instantiating the proc so we can set `stdout` if the user calls that function
      // so the contract is the user must call `stdout` within this event loop iteration
      const p = Promise.resolve().then(async () => {
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
