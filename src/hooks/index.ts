
import useExec from "./useExec.ts"
import useVirtualEnv from "./useVirtualEnv.ts"
import usePackageYAML, { usePackageYAMLFrontMatter } from "./usePackageYAML.ts"
import useVersion from "./useVersion.ts"
import useErrorHandler, { ExitError } from "./useErrorHandler.ts"
import usePrint from "./usePrint.ts"
import useConfig, { Verbosity } from "./useConfig.ts"
import useLogger from "./useLogger.ts"
import useRun, { RunError, RunOptions } from "./useRun.ts"

function usePrefix() {
  return useConfig().prefix
}

export {
  useExec,
  useVirtualEnv,
  usePackageYAML,
  usePackageYAMLFrontMatter,
  useVersion,
  useErrorHandler,
  usePrint,
  usePrefix,
  useConfig,
  useLogger,
  Verbosity,
  RunError,
  useRun,
  ExitError
}

export type { RunOptions }

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
