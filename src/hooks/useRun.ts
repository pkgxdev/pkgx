import { Path } from "tea"

export interface RunOptions extends Omit<Deno.CommandOptions, 'args'|'cwd'|'stdout'|'stderr'|'stdin'> {
  cmd: (string | Path)[]
  clearEnv?: boolean  //NOTE might not be cross platform!
}

export class RunError extends Error {
  code: number
  constructor(code: number, cmd: (Path | string)[]) {
    super(`cmd failed: ${code}: ${cmd.join(' ')}`)
    this.code = code
  }
}

export default async function useRun(opts: RunOptions) {
  const cmd = opts.cmd.map(x => `${x}`)
  const stdio = { stdout: 'inherit', stderr: 'inherit', stdin: 'inherit' } as Pick<Deno.CommandOptions, 'stdout'|'stderr'|'stdin'>

  console.log({ ...opts, cmd })

  try {
    const proc = _internals.nativeRun(cmd.shift()!, { ...opts, args: cmd, ...stdio }).spawn()
    const exit = await proc.status
    console.log({ exit })
    if (!exit.success) throw new RunError(exit.code, cmd)
  } catch (err) {
    err.cmd = cmd
    throw err
  }
}

const nativeRun = (cmd: string, opts: Deno.CommandOptions) => new Deno.Command(cmd, opts)

// _internals are used for testing
export const _internals = {
  nativeRun
}
