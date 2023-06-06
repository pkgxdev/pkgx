import useVersion from "./useVersion.ts"
import { parseBool } from "../args.ts"
import { Flags } from "../args.ts"
import { isNumber } from "is-what"
import { utils, Path } from "tea"
const { flatmap } = utils

import useConfig, { Config as ConfigBase, ConfigDefault as ConfigBaseDefault, _internals } from "tea/hooks/useConfig.ts"

export interface Config extends ConfigBase {
  arg0: Path

  logger: {
    prefix?: string
    color: boolean
  }

  env: {
    TEA_DIR?: Path
    TEA_PKGS?: string
    TEA_FILES?: string
    TEA_MAGIC?: string
    TEA_REWIND?: string
    TEA_FORK_BOMB_PROTECTOR?: string
    VERSION?: string
    SRCROOT?: string
    SHELL?: string
    PATH?: string

    obj: Record<string, string>
  }

  modifiers: {
    dryrun: boolean
    verbosity: Verbosity
    json: boolean
    keepGoing: boolean
  }
}

export default function(input?: Config): Config {
  if (!_internals.initialized()) {
    input ??= ConfigDefault()
  } else if (input) {
    console.warn("useConfig() already initialized, new parameters ignored")
    input = undefined
  }
  return useConfig(input) as Config
}

export function ConfigDefault(flags?: Flags, arg0 = Deno.execPath(), env = Deno.env.toObject()): Config {
  if (!env['TEA_PREFIX']) {
    // if we’re installed in a prefix, adopt that prefix
    const shelf = new Path(arg0)
      .readlink() // resolves the leaf symlink (if any)
      .parent()
      .parent()
      .parent()
    if (shelf.basename() == 'tea.xyz') {
      env['TEA_PREFIX'] = shelf.parent().string
    }
  }

  const defaults = ConfigBaseDefault(env)

  const {
    TEA_DIR,
    TEA_REWIND,
    TEA_FORK_BOMB_PROTECTOR,
    SHELL,
    TEA_FILES,
    TEA_PKGS,
    TEA_MAGIC,
    SRCROOT,
    VERSION,
    PATH
  } = env

  // we only output color & control sequences to stderr
  const isTTY = () => Deno.isatty(Deno.stderr.rid)

  return {
    ...defaults,
    arg0: new Path(arg0),
    UserAgent: `tea.cli/${useVersion()}`,
    logger: {
      prefix: undefined,
      color: getColor(env, isTTY)
    },
    modifiers: {
      dryrun: flags?.dryrun ?? false,
      verbosity: flags?.verbosity ?? getVerbosity(env, isTTY()),
      json: flags?.json ?? false,
      keepGoing: flags?.keepGoing ?? false,
    },
    env: {
      TEA_DIR: flatmap(TEA_DIR, x => Path.abs(x) ?? Path.cwd().join(x)),
      TEA_REWIND,
      TEA_FORK_BOMB_PROTECTOR,
      SHELL,
      TEA_FILES,
      TEA_MAGIC,
      TEA_PKGS,
      SRCROOT,
      VERSION,
      PATH,
      obj: env
    }
  }
}

export enum Verbosity {
  silent = -2,
  quiet = -1,
  normal = 0,
  loud = 1,
  debug = 2,
  trace = 3
}

function getVerbosity(env: Record<string, string>, sequences_ok: boolean): Verbosity {
  const { DEBUG, GITHUB_ACTIONS, RUNNER_DEBUG, VERBOSE, CI } = env

  if (DEBUG == '1') return Verbosity.debug
  if (GITHUB_ACTIONS == 'true' && RUNNER_DEBUG  == '1') return Verbosity.debug

  const verbosity = flatmap(VERBOSE, parseInt)
  if (isNumber(verbosity)) {
    return verbosity
  } else if (parseBool(CI) || !sequences_ok) {
    // prevents dumping 100s of lines of download progress
    return Verbosity.quiet
  } else {
    return Verbosity.normal
  }
}

function getColor(env: Record<string, string>, isTTY: () => boolean) {
  if ((env.CLICOLOR ?? '1') != '0' && isTTY()){
    //https://bixense.com/clicolors/
    return true
  }
  if ((env.CLICOLOR_FORCE ?? '0') != '0') {
    //https://bixense.com/clicolors/
    return true
  }
  if ((env.NO_COLOR ?? '0') != '0') {
    return false
  }
  if (env.CLICOLOR == '0' || env.CLICOLOR_FORCE == '0') {
    return false
  }
  if (env.CI) {
    // this is what charm’s lipgloss does, we copy their lead
    // however surely nobody wants `tea foo > bar` to contain color codes?
    // the thing is otherwise we have no color in CI since it is not a TTY
    return true
  }

  return false
}
