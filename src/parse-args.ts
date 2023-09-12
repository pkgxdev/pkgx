import { UsageError } from "./utils/error.ts"
import { Path, utils } from "tea"
const { flatmap } = utils

type Pkgs = {
  plus: string[]
  minus: string[]
}

export type Args = {
  flags: Flags
} & (
  {
    mode: 'x' | 'run'
    args: string[]
    pkgs: Pkgs
  } | {
    mode: 'internal.use'
    pkgs: Pkgs
  } | {
    mode: 'env'
    pkgs: {
      plus: string[]
      minus: string[]
    }
  } | {
    mode: 'shellcode' | 'version' | 'help'
  } | {
    mode: 'integrate' | 'deintegrate'
    dryrun: boolean
  } | {
    mode: 'which' | 'shell-completion'
    args: string[]
  } | {
    mode: 'internal.activate'
    dir: Path
  } | {
    mode: 'install'
    args: string[]
  }
)

interface Flags {
  sync: boolean
  update: boolean
  verbosity?: number
}

export default function(input: string[]): Args {
  const it = input[Symbol.iterator]()
  const pkgs: Pkgs = { plus: [], minus: [] }
  const args: string[] = []
  const flags: Flags = {
    sync: false,
    update: false
  }
  let mode: string | undefined
  let dryrun: boolean | undefined

  switch (input[0]) {
  case 'deintegrate':
  case 'integrate':
  case 'install':
  case 'run':
    mode = input[0]
    it.next()  // consume the subcommand
  }

  for (const arg of it) {
    const [type, content] = parse(arg)

    switch (type) {
    case '+':
      pkgs.plus.push(content)
      break
    case '-':
      pkgs.minus.push(content)
      break
    case '--':
      switch (content) {
      case 'sync':
        flags.sync = true
        break
      case 'update':
        flags.update = true
        break
      case 'shellcode':
      case 'integrate':
      case 'internal.activate':
      case 'help':
      case 'version':
      case 'which':
      case 'shell-completion':
      case 'internal.use':
        if (mode) throw new UsageError({msg: 'multiple modes specified'})
        mode = content
        break
      case 'silent':
        flags.verbosity = -2
        break
      case 'quiet':
        flags.verbosity = -1
        break
      case 'dry-run':
        dryrun = true
        break
      case '':
        // empty the main loop iterator
        for (const arg of it) args.push(arg)
        break
      default: {
        const match = content.match(/^verbose(=-?\d+)?$/)
        if (match) {
          flags.verbosity = flatmap(match[1], n => parseInt(n.slice(1))!) ?? 1
        } else {
          throw new UsageError(arg)
        }
      }}
      break
    default:
      /// unrecognized args means the start of the runner args
      args.push(arg)
      for (const arg of it) args.push(arg)
    }
  }

  if (dryrun !== undefined && mode != 'integrate' && mode != 'deintegrate') {
    throw new UsageError({msg: '--dry-run is only valid with --shellcode'})
  }

  switch (mode) {
  case undefined:
    if (args.length) {
      return { mode: 'x', flags, pkgs, args }
    } else {
      return { mode: 'env', flags, pkgs }
    }
  case 'internal.use':
    return { mode, flags, pkgs }
  case 'run':
    return { mode, flags, pkgs, args }
  case 'which':
  case 'shell-completion':
    return { mode, flags, args }
  case 'internal.activate':
    return { mode, flags, dir: new Path(args[0]) }
  case 'install':
    return { mode, flags, args }
  case 'integrate':
  case 'deintegrate':
    dryrun ??= false
    return { mode, dryrun, flags }
  default:
    return { mode: mode as any, flags }
  }
}


//////////////////////// utils

function parse(arg: string): ['+', string] | ['--', string] | ['-', string] | [undefined, string] {
  switch (arg[0]) {
  case '+': {
    const content = arg.slice(1)
    if (!content) throw new UsageError(arg)
    return ['+', content]
  }
  case '-':
    if (arg[1] == '-') {
      return ['--', arg.slice(2)]
    } else {
      const content = arg.slice(1)
      if (!content) throw new UsageError(arg)
      return ['-', content]
    }
  default:
    return [undefined, arg]
  }
}
