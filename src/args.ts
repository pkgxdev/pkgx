import Path from "path"
import { chuzzle, pkg, validate_str } from "utils"
import { PackageSpecification } from "types"
import { TeaError } from "utils"

export type Args = {
  cd?: Path
  mode: 'std' | 'help' | 'version' | 'prefix' | ['magic', string | undefined] | 'provides'
  sync: boolean
  args: string[]
  pkgs: PackageSpecification[]
  inject?: boolean
  chaste: boolean
}

export interface Flags {
  verbosity?: number
  dryrun: boolean
  keepGoing: boolean
  json: boolean
}

export function parseArgs(args: string[], arg0: string): [Args, Flags, Error?] {
  // pre 0.19.0 this was how we sourced our (more limited) shell magic
  if (new Set(['-Eds', '--env --keep-going --silent --dry-run=w/trace']).has(args.join(' '))) {
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
    chaste: false,
  }

  const flags: Flags = {
    dryrun: false,
    keepGoing: false,
    json: false,
  }

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
          flags.verbosity = 1
          break
        }
        const bi = chuzzle(parseInt(value) + 1)
        if (bi !== undefined) {
          flags.verbosity = bi
          break
        }
        const bv = parseBool(value)
        if (bv === undefined) throw new TeaError('not-found: arg', {arg})
        flags.verbosity = bv ? 1 : 0
      } break
      case 'debug':
        flags.verbosity = parseBool(hasvalue ? value : "yes") ? 2 : 0
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
        rv.mode = ['magic', value]
        break
      case 'json':
          flags.json = parseBool(value ?? "yes") ?? barf()
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
        flags.keepGoing = parseBool(value ?? "yes") ?? barf()
        break
      case 'quiet':
      case 'silent':
        nonovalue()
        flags.verbosity = -1
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
        flags.dryrun = parseBool(value ?? "yes") ?? barf()
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
          flags.verbosity = (flags.verbosity ?? 0) + 1
          break
        case 'C':
          rv.cd = Path.cwd().join(validate_str(it.next().value))
          break
        case 's':
          flags.verbosity = -1;
          break
        case 'X':
          console.warn("tea -X is now implicit and thus specifying `-X` now both unrequired and deprecated")
          break
        case 'k':
          flags.keepGoing = true
          break
        case 'd':
          console.warn("tea -d is deprecated, instead only provide pkg specifiers")
          break
        case 'S':
          rv.sync = true
          break
        case 'n':
          flags.dryrun = true
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

  return [rv, flags]
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
