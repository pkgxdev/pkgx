import useVirtualEnv, { VirtualEnv } from "./useVirtualEnv.ts"
import useYAMLFrontMatter from "./useYAMLFrontMatter.ts"
import useVersion from "./useVersion.ts"
import useErrorHandler, { ExitError } from "./useErrorHandler.ts"
import usePrint from "./usePrint.ts"
import useConfig, { Verbosity } from "./useConfig.ts"
import useLogger from "./useLogger.ts"
import useRun from "./useRun.ts"

function usePrefix() {
  return useConfig().prefix
}

export {
  useVirtualEnv,
  useYAMLFrontMatter,
  useVersion,
  useErrorHandler,
  usePrint,
  usePrefix,
  useConfig,
  useLogger,
  Verbosity,
  useRun,
  ExitError
}

export type { VirtualEnv }

declare global {
  interface Array<T> {
    uniq(): Array<T>
  }
}

Array.prototype.uniq = function<T>(): Array<T> {
  const set = new Set<T>()
  return this.compact(x => {
    const s = x.toString()
    if (set.has(s)) return
    set.add(s)
    return x
  })
}
