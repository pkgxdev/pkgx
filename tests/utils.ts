import Path from "path"
import { usePrefix } from "hooks"

export async function shout({ tea: args, cwd }: { tea: string[], cwd?: Path }) {
  const srcroot = Deno.env.get("SRCROOT")
  const cmd = [
    'deno',
    'run',
    '--allow-env', '--allow-read', '--allow-run',
    `--allow-write=${usePrefix()}`,
    `--import-map=${srcroot}/import-map.json`,
    `${srcroot}/src/app.ts`,
    ...args
  ]

  // unset these if set
  const env = {
    VERBOSE: '',
    DEBUG: '',
    TEA_DIR: ''
  }

  const proc = Deno.run({ cmd, stdout: "piped", cwd: cwd?.string, env})
  const raw = await proc.output()
  proc.close()

  return new TextDecoder().decode(raw)
}

export async function sandbox<T>(body: (tmpdir: Path) => Promise<T>) {
  const path = new Path(await Deno.makeTempDir({ prefix: "tea" }))
  try {
    return await body(path)
  } finally {
    await Deno.remove(path.string, { recursive: true })
  }
}
