import Path from "path"

interface Parameters { args: string[], net?: boolean, env?: Record<string, string> }

interface Enhancements {
  stdout(): Promise<string>
}

interface Tea {
  run(opts: Parameters): Promise<number> & Enhancements
  tmpdir: Path
}

export async function sandbox<T>(body: (tea: Tea) => Promise<T>) {
  const TEA_PREFIX = new Path(await Deno.makeTempDir({ prefix: "tea" }))

  const run = ({args, net, env}: Parameters) => {
    const srcroot = Deno.env.get("SRCROOT")
    const cmd = [
      'deno',
      'run',
      '--allow-env', '--allow-read', '--allow-run'
    ]

    if (net) cmd.push('--allow-net')

    const PATH = Deno.env.get("PATH")
    const HOME = Deno.env.get("HOME")
    if (!env) env = {}
    Object.assign(env, { PATH, TEA_PREFIX: TEA_PREFIX.string, HOME })

    cmd.push(
      '--unstable',
      //TODO allow read only this prefix too
      `--allow-write=${TEA_PREFIX}`,
      `--import-map=${srcroot}/import-map.json`,
      `${srcroot}/src/app.ts`,
      ...args.map(x => `${x}`)
    )

    let stdout: "piped" | undefined
    let proc: Deno.Process | undefined

    // we delay instantiating the proc so we can set `stdout` if the user calls that function
    // so the contract is the user must call `stdout` within this event loop iteration
    const p = Promise.resolve().then(() => {
      proc = Deno.run({ cmd, cwd: TEA_PREFIX.string, stdout, env, clearEnv: true})
      return proc.status()
    }) as Promise<number> & Enhancements

    p.stdout = () => {
      stdout = "piped"
      return p.then(async () => {
        const out = await proc!.output()
        return new TextDecoder().decode(out)
      })
    }

    p.then(() => proc!.close())
    p.catch(() => proc?.close())

    return p
  }

  try {
    return await body({
      tmpdir: TEA_PREFIX,
      run
    })
  } finally {
    await Deno.remove(TEA_PREFIX.string, { recursive: true })
  }
}
