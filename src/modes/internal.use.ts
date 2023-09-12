import escape_if_necessary from "../utils/sh-escape.ts"
import construct_env from "../prefab/construct-env.ts"
import install, { Logger } from "../prefab/install.ts"
import { PackageRequirement, utils } from "tea"

interface Pkgs {
  plus: PackageRequirement[]
  minus: PackageRequirement[]
  active: PackageRequirement[]
}

export default async function(opts: { pkgs: Pkgs, logger: Logger, pkgenv?: Record<string, string>, update: boolean | Set<string> }) {
  const { install, construct_env, getenv } = _internals

  const pkgs = consolidate(opts.pkgs)

  if (pkgs.length == 0) {
    return {
      shellcode: 'unset TEA_POWDER TEA_PKGENV',
      pkgenv: []
    }
  } else {
    let rv = ''
    const print = (x: string) => rv += x + '\n'

    const pkgenv = await install(pkgs, opts)
    const env = await construct_env(pkgenv)

    for (const [key, value] of Object.entries(env)) {
      print(`export ${key}=${escape_if_necessary(value)}`)
    }

    print(`export TEA_POWDER="${pkgenv.pkgenv.map(utils.pkg.str).join(' ')}"`)
    print(`export TEA_PKGENV="${pkgenv.installations.map(({pkg}) => utils.pkg.str(pkg)).join(' ')}"`)

    if (/\(tea\)/.test(getenv("PS1") ?? '') == false) {
      //FIXME doesn't work with warp.dev for fuck knows why reasons
      // https://github.com/warpdotdev/Warp/issues/3492
      print('export PS1="(tea) $PS1"')
    }

    print('')

    print('_tea_reset() {')
    for (const key in env) {
      const old = getenv(key)
      if (old !== undefined) {
        //TODO don’t export if not currently exported!
        print(`  export ${key}=${escape_if_necessary(old)}`)
      } else {
        print(`  unset ${key}`)
      }
    }
    const ps1 = getenv('PS1')
    print(ps1 ? `  export PS1="${ps1}"` : '  unset PS1')
    print('  unset -f _tea_reset _tea_install')
    print('}')

    const install_set = (({pkgenv, installations}) => {
      const set = new Set(pkgenv.map(({project}) => project))
      return installations.compact(({pkg}) => set.has(pkg.project) && pkg)
    })(pkgenv)

    print('')
    print('_tea_install() {')
    print(`  command tea install ${install_set.map(utils.pkg.str).join(' ')}`)
    print(`  tea ${pkgenv.pkgenv.map(x => `-${utils.pkg.str(x)}`).join(' ')}`)
    print('}')

    return {shellcode: rv, pkgenv: install_set}
  }
}

////////////////////////////////////////////////////////////////////////// utils
function consolidate(pkgs: Pkgs) {
  //FIXME inadequate
  const rv = [...pkgs.active, ...pkgs.plus]
  const set = new Set(pkgs.minus.map(({project}) => project))
  return rv.filter(({project}) => !set.has(project))
}

////////////////////////////////////////////////////////////////////// internals
export const _internals = {
  install,
  construct_env,
  getenv: Deno.env.get
}
