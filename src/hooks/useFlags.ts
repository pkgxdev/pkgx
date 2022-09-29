import { parseFlags } from "cliffy/flags/mod.ts"
import { flatmap, chuzzle } from "utils"
import { Verbosity, PackageRequirement } from "types"
import { isNumber } from "is_what"
import { set_tmp } from "path"
import { usePrefix } from "hooks"
import Path from "path"

// doing here as this is the only file all our scripts import
set_tmp(usePrefix().join('tea.xyz/tmp'))


export type Mode = 'exec' | ['dump', 'env' | 'help' | 'version' | 'prefix']

interface Flags {
  verbosity: Verbosity
  magic: boolean
  json: boolean
  numpty: boolean
}

interface ConvenienceFlags {
  verbose: boolean
  debug: boolean
  muggle: boolean
  silent: boolean
}

let flags: Flags

export default function useFlags(): Flags & ConvenienceFlags {
  if (!flags) {
    //FIXME scripts/* need this to happen but its yucky
    flags = {
      verbosity: getVerbosity({}),
      magic: getMagic(undefined),
      json: !!Deno.env.get("JSON"),
      numpty: !!Deno.env.get("NUMPTY")
    }
    applyVerbosity()
  }

  return {
    ...flags,
    verbose: flags.verbosity >= Verbosity.loud,
    debug: flags.verbosity >= Verbosity.debug,
    muggle: !flags.magic,
    silent: flags.verbosity <= Verbosity.quiet
  }
}

interface Adjustments {
  cd?: Path
}

interface Args {
  std: string[]
  fwd: string[]
  env: boolean
  pkgs: PackageRequirement[]
}

//FIXME -v=99 parses and gives v == 1
// probs we shouldn't allow this, you have to use --verbose to specify it thus

export type ReturnValue = { mode?: Mode } & Adjustments & { args: Args }

export function useArgs(args: string[]): ReturnValue {
  if (flags) throw "contract-violated"

  const parsedArgs = parseFlags(args, {
    /// passes args after the script argument to the script
    stopEarly: true,
    flags: [{
      name: "v",
      collect: true,
      value: (val: boolean, previous = 0) => val ? previous + 1 : 0,
    }, {
      name: "verbose"
    }, {
      name: "silent",
      aliases: ["s"]
    }, {
      name: "muggle",
      type: "boolean",
      aliases: ["m"]
    }, {
      name: "env",
      aliases: ["E"]
    }, {
      name: "dump",
      type: "string",
      optionalValue: true
    }, {
      name: "d"
    }, {
      name: "help",
      aliases: ["h"]
    }, {
      name: "cd",
      type: "string",
      aliases: ["C", "chdir"]
    }, {
      name: "exec",
      aliases: ["x"],
      type: "string"
    }, {
      name: "json",
      aliases: ["j"]
    }, {
      name: "version"
    }, {
      name: "prefix",
    }]
  }) as { flags: {
    verbose?: boolean,
    silent?: boolean,
    dump?: string | true,
    help?: boolean,
    env?: boolean,
    v?: number,
    muggle?: boolean,
    cd?: string,
    exec?: string,
    json: boolean,
    version: boolean,
    d: boolean,
    prefix: boolean
  }, unknown: string[], literal: string[] }

  const { flags: { d, version, prefix, verbose, json, silent, help, env, dump, v, muggle, cd, exec }, unknown, literal } = parsedArgs

  flags = {
    verbosity: getVerbosity({ v, verbose, silent}),
    magic: getMagic(muggle),
    json: json ?? !!Deno.env.get("JSON"),
    numpty: !!Deno.env.get("NUMPTY")
  }

  applyVerbosity()

  console.debug({ "raw-args": Deno.args })
  console.debug({ "parsed-args": parsedArgs })

  if ((exec?1:0) + (help?1:0) + (dump?1:0) > 1) throw "usage:invalid"

  // TEA_DIR must be absolute for security reasons
  const getcd = flatmap(cd, x => Path.cwd().join(x))

  return {
    ...getMode(),
    cd: getcd,
    args: {
      env: env ?? false,
      std: unknown,
      fwd: literal,
      pkgs: [] //FIXME
    }
  }

  function getMode(): { mode?: Mode } {
    if (dump == "prefix" || prefix) return { mode: ['dump', 'prefix'] }
    if (dump == "version" || version) return { mode: ['dump','version'] }
    if (dump == "help" || help) return { mode: ['dump','help'] }
    if (dump == "env" || dump === true || d) return { mode: ['dump','env'] }
    if (exec) return { mode: 'exec' }
    return {}
  }
}

function getVerbosity({v, verbose, silent}: {v?: number, verbose?: boolean, silent?: boolean}): Verbosity {
  if (isNumber(v) && isNumber(verbose)) return Math.max(verbose, v)
  if (isNumber(v)) return v
  if (verbose === true) return 2
  if (isNumber(verbose)) return verbose
  if (silent) return Verbosity.quiet
  const env = flatmap(flatmap(Deno.env.get("VERBOSE"), parseInt), chuzzle)
  if (isNumber(env)) return env + 1
  if (Deno.env.get("DEBUG") == '1') return Verbosity.debug
  if (Deno.env.get("GITHUB_ACTIONS") == 'true' && Deno.env.get("RUNNER_DEBUG") == '1') return Verbosity.debug
  return Verbosity.normal
}

function getMagic(muggle: boolean | undefined): boolean {
  if (muggle !== undefined) return !muggle
  const env = Deno.env.get("MAGIC")
  if (env === "0") return false
  return true
}

function applyVerbosity() {
  function noop() {}
  if (flags.verbosity < Verbosity.debug) console.debug = noop
  if (flags.verbosity < Verbosity.loud) console.verbose = noop
  if (flags.verbosity < Verbosity.normal) {
    console.log = noop
    console.error = noop
  }
}