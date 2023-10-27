import escape_if_necessary from "../utils/sh-escape.ts"
import construct_env from "../prefab/construct-env.ts"
import install, { Logger } from "../prefab/install.ts"
import { PackageRequirement, utils } from "pkgx"
import { basename } from "deno/path/basename.ts"

interface Pkgs {
  plus: PackageRequirement[]
  minus: PackageRequirement[]
  active: PackageRequirement[]
}

export default async function(opts: { pkgs: Pkgs, logger: Logger, pkgenv?: Record<string, string>, update: boolean | Set<string> }) {
  const { install, construct_env, getenv } = _internals
  const isfish = utils.flatmap(Deno.env.get("SHELL"), basename) == 'fish'

  const export_ = (key: string, value: string) => isfish
    ? `set -gx ${key} ${escape_if_necessary(value)}`
    : `export ${key}=${escape_if_necessary(value)}`

  const pkgs = consolidate(opts.pkgs)

  if (pkgs.length == 0) {
    const shellcode = `${isfish ? 'set -e' : 'unset'} PKGX_POWDER PKGX_PKGENV`
    return {
      shellcode,
      pkgenv: []
    }
  } else {
    let rv = ''
    const print = (x: string) => rv += x + '\n'

    const pkgenv = await install(pkgs, opts)
    const env = await construct_env(pkgenv)

    for (const [key, value] of Object.entries(env)) {
      print(export_(key, value))
    }

    print(export_('PKGX_POWDER', pkgenv.pkgenv.map(utils.pkg.str).join(' ')))
    print(export_('PKGX_PKGENV', pkgenv.installations.map(({pkg}) => utils.pkg.str(pkg)).join(' ')))

    // if (/\(pkgx\)/.test(getenv("PS1") ?? '') == false) {
    //   //FIXME doesn't work with warp.dev for fuck knows why reasons
    //   // https://github.com/warpdotdev/Warp/issues/3492
    //   print('export PS1="(pkgx) $PS1"')
    // }

    print('')

    print(isfish ? 'function _pkgx_reset' : '_pkgx_reset() {')
    for (const key in env) {
      const old = getenv(key)
      if (old !== undefined) {
        //TODO don’t export if not currently exported!
        print('  ' + export_(key, old))
      } else {
        print(`  ${isfish ? 'set -e' : 'unset'} ${key}`)
      }
    }

    // const ps1 = getenv('PS1')
    // print(ps1 ? `  export PS1="${ps1}"` : '  unset PS1')
    // print('  unset -f _pkgx_reset _pkgx_install')

    print(isfish ? 'end' : '}')

    const install_set = (({pkgenv, installations}) => {
      const set = new Set(pkgenv.map(({project}) => project))
      return installations.compact(({pkg}) => set.has(pkg.project) && pkg)
    })(pkgenv)

    print('')

    print(isfish ? 'function _pkgx_install' : '_pkgx_install() {')
    print(`  command pkgx install ${install_set.map(utils.pkg.str).join(' ')}`)
    print(`  env ${pkgenv.pkgenv.map(x => `-${utils.pkg.str(x)}`).join(' ')}`)
    print(isfish ? 'end' : '}')

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
