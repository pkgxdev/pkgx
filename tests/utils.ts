import Path from "path"

interface Parameters { args: string[], net?: boolean, env?: Record<string, string> }

interface Enhancements {
  stdout(): Promise<string>
}

interface Tea {
  run(opts: Parameters): Promise<number> & Enhancements
  tmpdir: Path
}

export async function sandbox<T>(body: (tea: Tea) => Promise<T>, { throws }: { throws: boolean } = {throws: true}) {
  const TEA_PREFIX = new Path(await Deno.makeTempDir({ prefix: "tea" }))

  const existing_www_cache = Path.home().join(".tea/tea.xyz/var/www")
  if (existing_www_cache.isDirectory()) {
    // we're not testing our ISP
    const to = TEA_PREFIX.join("tea.xyz/var").mkpath().join("www")
    const proc = Deno.run({cmd: [
      'ln', '-s', existing_www_cache.string, to.string
    ]})
    await proc.status()
    proc.close()
  }

  const run = ({args, net, env}: Parameters) => {
    const srcroot = Deno.env.get("SRCROOT")
    const cmd = [
      'deno',
      'run',
      '--allow-env', '--allow-run',
      '--allow-read'  // required for Deno.execPath() (sigh)
    ]

    if (net) cmd.push('--allow-net')

    const PATH = Deno.env.get("PATH")
    const HOME = Deno.env.get("HOME")
    const CI = Deno.env.get("HOME")
    if (!env) env = {}
    Object.assign(env, {
      PATH, HOME, CI,
      TEA_PREFIX: TEA_PREFIX.string
    })

    cmd.push(
      '--unstable',
      `--allow-write=${TEA_PREFIX},${existing_www_cache}`,
      `--import-map=${srcroot}/import-map.json`,
      `${srcroot}/src/app.ts`,
      ...args.map(x => `${x}`)
    )

    let stdout: "piped" | undefined

    // we delay instantiating the proc so we can set `stdout` if the user calls that function
    // so the contract is the user must call `stdout` within this event loop iteration
    const p = Promise.resolve().then(async () => {
      const proc = Deno.run({ cmd, cwd: TEA_PREFIX.string, stdout, env, clearEnv: true})
      try {
        const status = await proc.status()
        if (throws && !status.success) {
          throw status
        }
        if (stdout == 'piped') {
          const out = await proc.output()
          return new TextDecoder().decode(out)
        } else {
          return status
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

  try {
    return await body({
      tmpdir: TEA_PREFIX,
      run
    })
  } finally {
    await Deno.remove(TEA_PREFIX.string, { recursive: true })
  }
}
