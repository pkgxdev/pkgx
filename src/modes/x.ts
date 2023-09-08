import { PackageRequirement, Path, TeaError, hooks, semver } from "tea"
import install, { Logger } from "../prefab/install.ts"
import construct_env from "../prefab/construct-env.ts"
import resolve_arg0 from "../prefab/resolve-arg0.ts"
import { ProvidesError } from "../utils/error.ts"
import get_shebang from "../utils/get-shebang.ts"
import execve from "../utils/execve.ts"
const { usePantry, useSync } = hooks

//TODO be able to parse @latest for shebang result


export default async function(args: string[], { pkgs: dry, ...opts }: {
  update: boolean | Set<string>,
  pkgs?: PackageRequirement[],
  logger: Logger
}) {
  const { install, exec, construct_env, getenv } = _internals

  dry ??= []

  //TODO if contains PATH items then go directly to isFile path
  const wut = await find_it(args, dry)
  if (wut.pkg) dry.push(wut.pkg)
  args = wut.args

  if (wut.update) {
    if (opts.update instanceof Set) {
      opts.update.add(wut.pkg!.project)
    } else if (!opts.update) {
      opts.update = new Set([wut.pkg!.project])
    }
  }

  const pkgenv = await install(dry, opts)
  const env = await construct_env(pkgenv)

  for (const key in env) {
    env[key] = env[key].replaceAll(`\${${key}}`, getenv(key) ?? '')
  }

  // fork bomb protection
  const n = parseInt(getenv('TEA_LVL') ?? '0') + 1
  if (Number.isNaN(n)) throw new TeaError("invalid `$TEA_LVL`")
  env['TEA_LVL'] = `${n}`

  exec({ cmd: args, env })
}

////////////////////////////////////////////////////////////////////////// utils
export function barf(fn: () => Error): never {
  throw fn()
}

async function find_it(args: string[], dry: PackageRequirement[]) {
  if (args[0].includes('/')) {
    return await find_file(args, dry) ?? barf(() => new TeaError(`no such file: ${args[0]}`))
  }

  // magic pkg expansion
  let wut = await find_arg0(args, dry)
  if (wut) {
    return wut
  }

  /// we now check for a file `./foo` that was specified (plainly) `tea foo`
  wut = await find_file(args, dry)
  if (wut) {
    return wut
  }

  // be just works: do a sync in case this has been recently added to the pantry
  _internals.useSync()
  wut = await find_arg0(args, dry)
  if (wut) {
    return wut
  }

  throw new ProvidesError(args[0])
}

interface Wut {
  pkg?: PackageRequirement
  args: string[]
  update?: boolean
}

async function find_arg0(args: string[], dry: PackageRequirement[]): Promise<Wut | undefined>  {
  const { which } = _internals
  const update = args[0].endsWith("@latest")
  const arg0 = update ? args[0].slice(0, -7) : args[0]
  const pkg = await which(arg0, dry)
  if (pkg) {
    args = [...pkg.shebang, ...args.slice(1)]
    return { pkg, args, update }
  }
}

async function find_file(args: string[], dry: PackageRequirement[]): Promise<Wut | undefined> {
  const { which, get_interpreter, get_shebang } = _internals

  const path = (Path.abs(args[0]) ?? Path.cwd().join(args[0])).isFile()
  if (!path) return

  let shebang = await get_shebang(path)
  const was_tea = shebang?.[0] == 'tea'

  if (was_tea) {
    if (shebang!.length == 1) {
      shebang = undefined
    } else {
      throw new TeaError("usage: pls invoke script directly")
    }
  }

  if (shebang) {
    const wut = await which(shebang[0], dry)
    if (!wut) throw new ProvidesError(shebang[0])
    args = [...shebang, ...args]
    return { pkg: wut, args }
  } else {
    const interpreter = await get_interpreter({ interprets: path.extname() })
    if (interpreter) {
      args = [...interpreter.args, ...args]
      const pkg = { project: interpreter.project, constraint: new semver.Range('*') }
      return { pkg, args }
    } else if (was_tea) {
      throw new TeaError("cannot infer interpreter")
    } else {
      return { args }
    }
  }
}

////////////////////////////////////////////////////////////////////// internals
export const _internals = {
  install,
  exec: execve,
  which: resolve_arg0,
  construct_env,
  getenv: Deno.env.get,
  useSync,
  get_interpreter: usePantry().which,
  get_shebang
}
