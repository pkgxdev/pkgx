import { parseFlags } from "cliffy/flags/mod.ts"
import { flatMap, chuzzle } from "utils"
import { Path, Verbosity, PackageRequirement, parsePackageRequirement } from "types"
import { isNumber } from "utils"

type Mode = {
  mode: 'run'
  script: Path | URL
  args: string[]
  useVirtualEnv: boolean
} | {
  mode: 'help'
} | {
  mode: 'dump'
  script?: Path | URL
  env: boolean
} | {
  mode: 'exec'
  cmd: [PackageRequirement, {bin: string}]
  args: string[]
}

interface Flags {
  verbosity: Verbosity
  magic: boolean
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
      magic: getMagic(undefined)
    }
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

//FIXME -v=99 parses and gives v == 1
// probs we shouldn't allow this, you have to use --verbose to specify it thus

export function useArgs(args: string[]): Mode & Adjustments {
  if (flags) throw "contract-violated"

  const parsedArgs = parseFlags(args, {
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
      aliases: ["d"]
    }, {
      name: "help",
      aliases: ["h"]
    }, {
      name: "cd",
      type: "string",
      aliases: ["C", "chdir"]
    }, {
      name: "exec",
      type: "string"
    }]
  }) as { flags: {
    verbose?: boolean,
    silent?: boolean,
    dump?: boolean,
    help?: boolean,
    env?: boolean,
    v?: number,
    muggle?: boolean,
    cd?: string,
    exec: string
  }, unknown: string[], literal: string[] }

  const { flags: { verbose, silent, help, env, dump, v, muggle, cd, exec }, unknown, literal } = parsedArgs

  flags = {
    verbosity: getVerbosity({ v, verbose, silent}),
    magic: getMagic(muggle)
  }

  function noop() {}
  if (flags.verbosity < Verbosity.debug) console.debug = noop
  if (flags.verbosity < Verbosity.loud) console.verbose = noop
  if (flags.verbosity < Verbosity.normal) {
    console.log = noop
    console.error = noop
  }

  console.debug({ parsedArgs })

  return {
    ...get(),
    cd: flatMap(cd, x => Path.cwd().join(x))
  }

  function get(): Mode {
    if (help) {
      if (env || dump) throw "usage:invalid"
      return { mode: 'help' }
    }
    if (dump) {
      if (unknown.length < 1 && !env) throw "file argument required"
      return {
        mode: 'dump',
        env: env ?? false,
        script: flatMap(unknown[0], PathOrURL)
      }
    }
    if (exec) {
      const pkg = parsePackageRequirement(exec)
      const [bin, ...args] = literal
      return {
        mode: 'exec',
        cmd: [pkg, {bin}],
        args
      }
    }
    if (unknown.length < 1) throw "file argument required"
    const [arg0, ...args] = unknown
    return {
      mode: 'run',
      useVirtualEnv: env ?? false,
      script: PathOrURL(arg0),
      args
    }
  }
}

function PathOrURL(input: string): Path | URL {
  try {
    return new URL(input)
  } catch {
    return Path.cwd().join(input)
  }
}

function getVerbosity({v, verbose, silent}: {v?: number, verbose?: boolean, silent?: boolean}): Verbosity {
  if (isNumber(v) && isNumber(verbose)) return Math.max(verbose, v)
  if (isNumber(v)) return v
  if (verbose === true) return 2
  if (isNumber(verbose)) return verbose
  if (silent) return Verbosity.quiet
  const env = flatMap(flatMap(Deno.env.get("VERBOSE"), parseInt), chuzzle)
  if (isNumber(env)) return env + 1
  if (Deno.env.get("DEBUG") == '1') return Verbosity.debug
  return Verbosity.normal
}

function getMagic(muggle: boolean | undefined): boolean {
  if (muggle !== undefined) return !muggle
  const env = Deno.env.get("MAGIC")
  if (env === "0") return false
  return true
}
