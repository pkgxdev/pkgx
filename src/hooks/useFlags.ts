import { flatmap, chuzzle, pkg, validate_str, panic } from "utils"
import { Verbosity, PackageSpecification } from "types"
import { isNumber } from "is_what"
import { set_tmp } from "path"
import { usePrefix } from "hooks"
import Path from "path"
import {TeaError} from "../utils/index.ts";

// doing here as this is the only file all our scripts import
set_tmp(usePrefix().join('tea.xyz/tmp'))


export type Mode = 'exec' | 'eXec' | ['dump', 'env' | 'help' | 'version' | 'prefix']

interface Flags {
  verbosity: Verbosity
  magic: boolean
  json: boolean
  numpty: boolean
  sync: boolean
}

interface ConvenienceFlags {
  verbose: boolean
  debug: boolean
  silent: boolean
}

let flags: Flags

export default function useFlags(): Flags & ConvenienceFlags {
  if (!flags) {
    //FIXME scripts/* need this to happen but its yucky
    flags = {
      sync: false,
      verbosity: getVerbosity(0),
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
    silent: flags.verbosity <= Verbosity.quiet
  }
}

interface Adjustments {
  cd?: Path
}

export type Args = {
  mode?: Mode
  cd?: Path
  args: string[]
  pkgs: PackageSpecification[]
  env?: boolean
}

export function useArgs(args: string[], arg0: string): [Args, Flags & ConvenienceFlags] {
  if (flags) throw new Error("contract-violated");

  (() => {
    const link = new Path(arg0).isSymlink()
    if (link === undefined || link.basename() === "tea") return
    const target = link.readlink().isSymlink()
    // if node is a symlink to node^16 to tea, then we should use node^16
    const base = target?.basename().startsWith(link.basename())
      ? target.basename()
      : link.basename()
    const match = base.match(/^tea_([^\/]+)$/)
    args = ["-X", match?.[1] ?? base, ...args]
  })()

  const rv: Args = {
    args: [],
    pkgs: []
  }

  let magic: boolean | undefined
  let v: number | undefined
  let sync = false
  const it = args[Symbol.iterator]()

  for (const arg of it) {
    if (arg == '+' || arg == '-' || arg == '--') {
      throw new TeaError('not-found: arg', {arg})
    }

    if (arg.startsWith('+')) {
      rv.pkgs.push(pkg.parse(arg.slice(1)))
    } else if (arg.startsWith('--')) {
      const [,key, , value] = arg.match(/^--([\w-]+)(=(.+))?$/)!

      switch (key) {
      case 'dump':
        switch (value) {
        case 'help':
          rv.mode = ['dump', 'help']
          break
        case 'version':
          rv.mode = ['dump', 'version']
          break
        case 'prefix':
          rv.mode = ['dump', 'prefix']
          break
        case 'env':
        case undefined:
          rv.mode = ['dump', 'env']
          break
        default:
          throw new Error("usage")
        }
        break
      case 'verbose':
        if (value) {
          v = chuzzle(parseInt(value) + 1) ?? panic()
        } else {
          v = 1
        }
        break
      case 'debug':
        v = 2
        break
      case 'cd':
      case 'chdir':
        rv.cd = Path.cwd().join(validate_str(value ?? it.next().value))
        break
      case 'help':
        rv.mode = ['dump', 'help']
        break
      case 'prefix':
        rv.mode = ['dump', 'prefix']
        break
      case 'version':
        rv.mode = ['dump', 'version']
        break
      case 'muggle':
      case 'disable-magic':
        magic = false
        break
      case 'magic':
        magic = !!parseBool(value)
        break
      case 'silent':
        v = -1
        break
      case 'sync':
        sync = true
        break
      case 'env':
        rv.env = parseBool(value) ?? true
        break
      case 'disable-env':
        rv.env = false
        break
      default:
        throw new TeaError('not-found: arg', {arg})
      }
    } else if (arg.startsWith('-')) {
      for (const c of arg.slice(1)) {
        switch (c) {
        case 'x':
          rv.mode = 'exec'
          break
        case 'X':
          rv.mode = 'eXec'
          break
        case 'E':
          rv.env = true
          break
        case 'd':
          rv.mode = ['dump', 'env']
          break
        case 'v':
          v = (v ?? 0) + 1
          break
        case 'C':
          rv.cd = Path.cwd().join(validate_str(it.next().value))
          break
        case 'm':
          magic = false
          break
        case 'M':
          magic = true
          break
        case 's':
          v = -1;
          break
        case 'S':
          sync = true
          break
        case 'h':
          rv.mode = ['dump', 'help']
          break
        default:
          throw new TeaError('not-found: arg', {arg: `-${c}`})
        }
      }
    } else {
      rv.args.push(arg)
      for (const arg of it) {  // empty the main loop iterator
        rv.args.push(arg)
      }
    }
  }

  flags = {
    verbosity: getVerbosity(v),
    magic: getMagic(magic),
    json: !!Deno.env.get("JSON"),
    numpty: !!Deno.env.get("NUMPTY"),
    sync
  }

  applyVerbosity()

  const full_flags = useFlags()
  console.debug({ args: rv, flags: full_flags })

  return [rv, full_flags]
}

function getVerbosity(v: number | undefined): Verbosity {
  if (isNumber(v)) return v
  if (Deno.env.get("DEBUG") == '1') return Verbosity.debug
  if (Deno.env.get("GITHUB_ACTIONS") == 'true' && Deno.env.get("RUNNER_DEBUG") == '1') return Verbosity.debug
  const env = flatmap(Deno.env.get("VERBOSE"), parseInt)
  return isNumber(env) ? env : Verbosity.normal
}

function getMagic(magic: boolean | undefined): boolean {
  if (magic !== undefined) return magic
  const env = Deno.env.get("MAGIC")
  //NOTE darwinsys.com/file uses `MAGIC` and has since 1995 so they have dibs
  // however it’s basically ok since we provide the above hatch to disable
  // magic and our default is on so if it is set to a Path then nothing is actually
  // different from if it wasn't set at all.
  return env !== "0"
}

function applyVerbosity() {
  function noop() {}
  if (flags.verbosity > Verbosity.debug) flags.verbosity = Verbosity.debug
  if (flags.verbosity < Verbosity.debug) console.debug = noop
  if (flags.verbosity < Verbosity.loud) console.verbose = noop
  if (flags.verbosity < Verbosity.normal) {
    console.info = noop
    console.log = noop
    console.error = noop
  }
}

function parseBool(input: string) {
  switch (input) {
  case '1':
  case 'true':
  case 'yes':
  case 'on':
  case 'enable':
    return true
  case '0':
  case 'false':
  case 'no':
  case 'off':
  case 'disable':
    return false
  }
}
