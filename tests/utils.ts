import Path from "path"
import { usePrefix } from "hooks"

interface Parameters { tea: string[], cwd?: Path, net?: boolean, env?: Record<string, string>, stdout?: "piped" }

function internal({ tea: args, cwd, net, env, stdout }: Parameters) {
  const srcroot = Deno.env.get("SRCROOT")
  const cmd = [
    'deno',
    'run',
    '--allow-env', '--allow-read', '--allow-run'
  ]

  if (net) cmd.push('--allow-net')

  const PATH = Deno.env.get("PATH")
  const TEA_PREFIX = env?.TEA_PREFIX || Deno.env.get("TEA_PREFIX")
  const HOME = Deno.env.get("HOME")
  if (!env) env = {}
  Object.assign(env, { PATH, TEA_PREFIX, HOME })

  const prefix = TEA_PREFIX || usePrefix()

  cmd.push(
    '--unstable',
    `--allow-write=${prefix}`,
    `--import-map=${srcroot}/import-map.json`,
    `${srcroot}/src/app.ts`,
    ...args
  )

  return Deno.run({ cmd, cwd: cwd?.string, stdout, env, clearEnv: true})
}

export async function backticks(opts: Parameters) {
  const proc = internal({...opts, stdout: "piped"})
  const raw = await proc.output()
  const code = await proc.status()
  proc.close()

  if (!code.success) throw {error: true, opts}

  return new TextDecoder().decode(raw)
}

export async function system(opts: Parameters) {
  const proc = internal(opts)
  const code = await proc.status()
  proc.close()
  if (!code.success) throw {error: true, opts}
  return code
}

export async function sandbox<T>(body: (tmpdir: Path) => Promise<T>) {
  const path = new Path(await Deno.makeTempDir({ prefix: "tea" }))
  try {
    return await body(path)
  } finally {
    await Deno.remove(path.string, { recursive: true })
  }
}
