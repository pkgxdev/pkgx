import { isArray } from "is-what"
import { Path } from "tea"

export interface RunOptions extends Omit<Deno.CommandOptions, 'args'|'cwd'|'stdout'|'stderr'|'stdin'> {
  cmd: (string | Path)[] | Path
  cwd?: (string | Path)
  clearEnv?: boolean  //NOTE might not be cross platform!
  spin?: boolean  // hide output unless an error occurs
}

export class RunError extends Error {
  code: number
  constructor(code: number, cmd: (Path | string)[]) {
    super(`cmd failed: ${code}: ${cmd.join(' ')}`)
    this.code = code
  }
}

export default async function useRun({ spin, ...opts }: RunOptions) {
  const cmd = isArray(opts.cmd) ? opts.cmd.map(x => `${x}`) : [opts.cmd.string]
  const cwd = opts.cwd?.toString()
  console.log({ cwd, ...opts, cmd })

  const stdio = { stdout: 'inherit', stderr: 'inherit', stdin: 'inherit' } as Pick<Deno.CommandOptions, 'stdout'|'stderr'|'stdin'>
  if (spin) {
    stdio.stderr = stdio.stdout = 'piped'
  }

  let proc: Deno.ChildProcess | undefined
  try {
    proc = _internals.nativeRun(cmd.shift()!, { ...opts, args: cmd, cwd, ...stdio }).spawn()
    const exit = await proc.status
    console.log({ exit })
    if (!exit.success) throw new RunError(exit.code, cmd)
  } catch (err) {
    if (spin && proc) {
      //FIXME this doesn’t result in the output being correctly interlaced
      // ie. stderr and stdout may (probably) have been output interleaved rather than sequentially
      const decode = (() => { const e = new TextDecoder(); return e.decode.bind(e) })()
      console.error(decode((await proc.output()).stdout))
      console.error(decode((await proc.output()).stderr))
    }

    err.cmd = cmd  // help us out since deno-devs don’t want to
    throw err
  }
}


const nativeRun = (cmd: string, opts: Deno.CommandOptions) => new Deno.Command(cmd, opts)

// _internals are used for testing
export const _internals = {
  nativeRun
}
