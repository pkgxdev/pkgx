import Path from "path";
import { Verbosity } from "../types.ts";
import { set_tmp } from "path"

export interface EnvAccessor {
  getEnvAsObject: () => { [index: string]: string }
}

export interface Env {
  CI?: string
  CLICOLOR?: string
  CLICOLOR_FORCE?: string
  DEBUG?: string
  GITHUB_ACTIONS?: string
  GITHUB_TOKEN?: string
  NO_COLOR?: string
  PATH?: string
  RUNNER_DEBUG?: string
  SHELL?: string
  SRCROOT?: string
  TEA_DIR?: string
  TEA_FILES?: string
  TEA_FORK_BOMB_PROTECTOR?: string
  TEA_PANTRY_PATH?: string
  TEA_PKGS?: string
  TEA_PREFIX?: string
  TEA_REWIND?: string
  VERBOSE?: string
  VERSION?: string
}

export interface Config {
  isCI: boolean

  execPath: Path
  loggerGlobalPrefix?: string
  teaPrefix: Path

  verbosity: Verbosity
  dryrun: boolean
  keepGoing: boolean

  verbose: boolean
  debug: boolean
  silent: boolean

  env: Env
}

let config: Config | undefined;

// Apply config should only be called once during application initialization
export function applyConfig(cf: Config) {
  config = cf
  set_tmp(config.teaPrefix.join('tea.xyz/tmp'))
  applyVerbosity(config)
}

function applyVerbosity(config: Config) {
  function noop() {}
  if (config.verbosity > Verbosity.debug) config.verbosity = Verbosity.debug
  if (config.verbosity < Verbosity.debug) console.debug = noop
  if (config.verbosity < Verbosity.loud) console.verbose = noop
  if (config.verbosity < Verbosity.normal) {
    console.info = noop
    console.warn = noop
    console.log = noop
    console.error = noop
  }
}

// useConfig provides the global configuration state of the application.
// It must not be called until applyConfig has been called.
export default function useConfig(): Readonly<Config> {
  if (!config) {
    throw Error("contract-violated: config must be applied before it can be used.")
  }

  return config
}

export function useEnv(): Readonly<Env> & EnvAccessor {
  const { env } = useConfig()
  return {
    ...env,
    getEnvAsObject: _internals.getEnvAsObject
  }
}

const nativeGetEnvAsObject = () => Deno.env.toObject()

// _internals are used for testing
export const _internals = {
  getConfig: () => config,
  setConfig: (c: Config) => config = c,
  getEnvAsObject: nativeGetEnvAsObject,
}
