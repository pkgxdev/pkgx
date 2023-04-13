import { Flags } from "./args.ts"
import { applyConfig, Config, Env } from "hooks/useConfig.ts"
import Path from "path";
import { isNumber } from "is_what"
import { Verbosity } from "./types.ts";
import { flatmap } from "utils"

export function init(flags?: Flags) {
  const config = createConfig(flags)
  applyConfig(config)
}

export function createConfig(flags?: Flags): Config {
  const env = collectEnv()

  const isCI = !!env.CI

  const execPath = new Path(Deno.execPath())
  const loggerGlobalPrefix = (!Deno.isatty(Deno.stdout.rid) || isCI) ? "tea:" : undefined
  const teaPrefix = findTeaPrefix(execPath, env.TEA_PREFIX)

  const verbosity = getVerbosity(flags?.verbosity, env)
  const dryrun = !!flags?.dryrun
  const keepGoing = !!flags?.keepGoing

  const json = !!flags?.json

  return {
    isCI,
    execPath,
    loggerGlobalPrefix,
    teaPrefix,
    verbosity,
    dryrun,
    keepGoing,
    verbose: verbosity >= Verbosity.loud,
    debug: verbosity >= Verbosity.debug,
    silent: verbosity <= Verbosity.quiet,
    env,
    json,
  }
}

export function collectEnv(): Env {
  return {
    CI: Deno.env.get("CI"),
    CLICOLOR: Deno.env.get("CLICOLOR"),
    CLICOLOR_FORCE: Deno.env.get("CLICOLOR_FORCE"),
    DEBUG: Deno.env.get("DEBUG"),
    GITHUB_ACTIONS: Deno.env.get("GITHUB_ACTIONS"),
    GITHUB_TOKEN: Deno.env.get("GITHUB_TOKEN"),
    NO_COLOR: Deno.env.get("NO_COLOR"),
    PATH: Deno.env.get("PATH"),
    RUNNER_DEBUG: Deno.env.get("RUNNER_DEBUG"),
    SHELL: Deno.env.get("SHELL"),
    SRCROOT: Deno.env.get("SRCROOT"),
    TEA_DIR: Deno.env.get("TEA_DIR"),
    TEA_FILES: Deno.env.get("TEA_FILES"),
    TEA_FORK_BOMB_PROTECTOR: Deno.env.get("TEA_FORK_BOMB_PROTECTOR"),
    TEA_PANTRY_PATH: Deno.env.get("TEA_PANTRY_PATH"),
    TEA_PKGS: Deno.env.get("TEA_PKGS"),
    TEA_PREFIX: Deno.env.get("TEA_PREFIX"),
    TEA_REWIND: Deno.env.get("TEA_REWIND"),
    VERBOSE: Deno.env.get("VERBOSE"),
    VERSION: Deno.env.get("VERSION")
  }
}

export const findTeaPrefix = (execPath: Path, envVar?: string) => {
  //NOTE doesn't work for scripts as Deno.run doesn't push through most env :/
  if (envVar) {
    return new Path(envVar)
  } else {
    // we’re either deno.land/vx/bin/deno, tea.xyz/vx/bin/tea or some symlink to the latter
    const shelf = execPath
      .readlink() // resolves the leaf symlink (if any)
      .parent()
      .parent()
      .parent()

    switch (shelf.basename()) {
    case 'tea.xyz':
    case 'deno.land':
      return shelf.parent()
    default:
      // we’re being generous for users who just download `tea` by itself
      // and execute it without installing it in a sanctioned structure
      return Path.home().join(".tea")
    }
  }
}

function getVerbosity(v: number | undefined, env: Env): Verbosity {
  const { DEBUG, GITHUB_ACTIONS, RUNNER_DEBUG, VERBOSE } = env

  if (isNumber(v)) return v
  if (DEBUG == '1') return Verbosity.debug
  if (GITHUB_ACTIONS == 'true' && RUNNER_DEBUG  == '1') return Verbosity.debug

  const verbosity = flatmap(VERBOSE, parseInt)
  return isNumber(verbosity) ? verbosity : Verbosity.normal
}
