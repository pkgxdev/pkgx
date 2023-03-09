import { default as realUseRun, RunOptions } from "../../src/hooks/useRun.ts"
export type { RunOptions } from "../../src/hooks/useRun.ts"
export { RunError } from "../../src/hooks/useRun.ts"

export default function useRun(runOptions: RunOptions): Promise<void> {
  return _internals.run(runOptions)
}

export const _internals = {
  run: realUseRun
}
