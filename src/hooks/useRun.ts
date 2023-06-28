import execv from "../utils/execve.ts"

export default function(opts: { cmd: string[], env: Record<string, string>}) {
  console.log(opts)
  _internals.nativeRun(opts)
}

// _internals are used for testing
export const _internals = {
  nativeRun: execv
}
