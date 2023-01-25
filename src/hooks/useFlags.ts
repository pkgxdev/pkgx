import { flatmap, chuzzle, pkg, validate_str } from "utils"
import { Verbosity, PackageSpecification } from "types"
import { isNumber } from "is_what"
import { set_tmp } from "path"
import { usePrefix } from "hooks"
import Path from "path"
import {TeaError} from "utils"

// doing here as this is the only file all our scripts import
set_tmp(usePrefix().join('tea.xyz/tmp'))

interface Flags {
  verbosity: Verbosity
  dryrun: boolean
  keep_going: boolean
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
      verbosity: getVerbosity(0),
      keep_going: false,
      dryrun: false  //FIXME should be true
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

export type Args = {
  cd?: Path
  mode: 'std' | 'help' | 'version' | 'prefix' | 'magic' | 'provides'
  sync: boolean
  args: string[]
  pkgs: PackageSpecification[]
  inject?: boolean
  chaste: boolean
}

export function useArgs(args: string[], arg0: string): [Args, Flags & ConvenienceFlags] {
  if (flags) throw new Error("contract-violated")

  // pre 0.19.0 this was how we sourced our (more limited) shell magic
  if (args.length == 1 && args[0] == "-Eds") {
    args = ["--magic", "--silent"]
  } else if (args.join(' ') == '--env --keep-going --silent --dry-run=w/trace') {
    args = ["+tea.xyz/magic", "-Esk", "--chaste", "env"]
  }

  (() => {
    const link = new Path(arg0)
    if (link.basename() === "tea") return
    const target = link.readlink().isSymlink()
    // if node is a symlink to node^16 to tea, then we should use node^16
    const base = target?.basename().startsWith(link.basename())
      ? target.basename()
      : link.basename()
    const match = base.match(/^tea[_+]([^\/]+)$/)
    args = [match?.[1] ?? base, ...args]
  })()

  const rv: Args = {
    mode: 'std',
    args: [],
    pkgs: [],
    sync: false,
    chaste: false
  }

  let keep_going = false
  let v: number | undefined
  let dryrun = false
  const it = args[Symbol.iterator]()

  for (const arg of it) {
    const barf = (arg_?: string) => { throw new TeaError('not-found: arg', {arg: arg_ ?? arg}) }

    if (arg == '+' || arg == '-') {
      throw new TeaError('not-found: arg', {arg})
    }

    if (arg.startsWith('+')) {
      rv.pkgs.push(pkg.parse(arg.slice(1)))
    } else if (arg == '--') {
      for (const arg of it) {  // empty the main loop iterator
        rv.args.push(arg)
      }
    } else if (arg.startsWith('--')) {
      const [,key, , value] = arg.match(/^--([\w-]+)(=(.+))?$/)!

      const hasvalue = !!value
      const nonovalue = () => { if (hasvalue) barf() }

      switch (key) {
      case 'verbose': {
        if (!hasvalue) {
          v = 1
          break
        }
        const bi = chuzzle(parseInt(value) + 1)
        if (bi !== undefined) {
          v = bi
          break
        }
        const bv = parseBool(value)
        if (bv === undefined) throw new TeaError('not-found: arg', {arg})
        v = bv ? 1 : 0
      } break
      case 'debug':
        v = parseBool(hasvalue ? value : "yes") ? 2 : 0
        break
      case 'cd':
      case 'chdir':
      case 'cwd':   // ala bun
        rv.cd = Path.cwd().join(validate_str(value ?? it.next().value))
        break
      case 'help':
        nonovalue()
        rv.mode = 'help'
        break
      case 'magic':
        rv.mode = 'magic'
        break
      case 'prefix':
      case 'version':
        nonovalue()
        rv.mode = key
        break
      case 'provides':
        nonovalue()
        rv.mode = 'provides'
        break
      case 'keep-going':
        keep_going = parseBool(value ?? "yes") ?? barf()
        break
      case 'quiet':
      case 'silent':
        nonovalue()
        v = -1
        break
      case 'dump':
        console.warn("tea --dump is deprecated, instead only provide pkg specifiers")
        break
      case 'sync':
        nonovalue()
        rv.sync = true
        break
      case 'dry-run':
      case 'just-print': //ala make
      case 'recon':      //ala make
        dryrun = parseBool(value ?? "yes") ?? barf()
        break
      case 'env':
        rv.inject = parseBool(value ?? "yes") ?? barf()
        break
      case 'chaste':
        rv.chaste = parseBool(value ?? "yes") ?? barf()
        break
      default:
        barf()
      }
    } else if (arg.startsWith('-')) {
      for (const c of arg.slice(1)) {
        switch (c) {
        case 'v':
          v = (v ?? 0) + 1
          break
        case 'C':
          rv.cd = Path.cwd().join(validate_str(it.next().value))
          break
        case 's':
          v = -1;
          break
        case 'X':
          console.warn("tea -X is now implicit and thus specifying `-X` now both unrequired and deprecated")
          break
        case 'k':
          keep_going = true
          break
        case 'd':
          console.warn("tea -d is deprecated, instead only provide pkg specifiers")
          break
        case 'S':
          rv.sync = true
          break
        case 'n':
          dryrun = true
          break
        case 'E':
          rv.inject = true
          break
        case 'h':
        case '?':
          rv.mode = 'help'
          break
        default:
          barf(`-${c}`)
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
    keep_going,
    dryrun
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
