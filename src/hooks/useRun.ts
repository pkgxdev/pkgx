import execv from "../utils/execve.ts"
import { Path } from "tea"

export default async function(opts: { cmd: string[], env: Record<string, string>}): Promise<Deno.CommandStatus> {
  console.log(opts)
  const proc = _internals.nativeRun(opts).spawn()

  /// the above is execv so the following code only runs during tests
  const rv = await proc.status
  console.log(rv)
  if (!rv.success) {
    throw new RunError(rv.code, opts.cmd)
  }
  return rv
}

export class RunError extends Error {
  code: number
  constructor(code: number, cmd: (Path | string)[]) {
    super(`cmd failed: ${code}: ${cmd.join(' ')}`)
    this.code = code
  }
}

// _internals are used for testing
export const _internals = {
  nativeRun: execv
}
