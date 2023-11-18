import { PackageRequirement, Path, PkgxError, hooks, utils } from "pkgx"
import escape_if_necessary from "../utils/sh-escape.ts"
import construct_env  from "../prefab/construct-env.ts"
import install, { Logger } from "../prefab/install.ts"
import { blurple } from "../utils/color.ts"
import devenv from "../utils/devenv.ts"
import undent from "outdent"

export default async function(dir: Path, { powder, ...opts }: { powder: PackageRequirement[], logger: Logger }) {
  const { install, construct_env, datadir, getenv, apply_userenv } = _internals

  if (!dir.isDirectory()) {
    throw new PkgxError(`not a directory: ${dir}`)
  }
  if (dir.eq(Path.home()) || dir.eq(Path.root)) {
    throw new PkgxError(`refusing to activate: ${dir}`)
  }

  const { pkgs, env: userenv } = await devenv(dir)

  const devenv_pkgs = [...pkgs]
  pkgs.push(...powder)

  if (pkgs.length <= 0 && Object.keys(userenv).length <= 0) {
    throw new PkgxError("no env")
  }

  /// indicate to our shell scripts that this devenv is activated
  const persistence = datadir().join("dev", dir.string.slice(1)).mkdir('p').join("dev.pkgx.activated").touch()

  const installations = await install(pkgs, { update: false, ...opts })
  const env = await construct_env(installations)

  /// we only want to tell the user about NEW packages added to the env
  const rv_pkgenv = (installed => {
    const set = new Set(devenv_pkgs.map(({project}) => project))
    return installed.filter(x => set.has(x.project))
  })(installations.pkgenv)

  // substitute or replace calculated env with user-supplied env from the keyfiles
  apply_userenv(env, userenv)

  let rv = ''
  for (const [key, value] of Object.entries(env)) {
    const existing_value = getenv(key)
    if (value == existing_value) {
      delete env[key]
      continue
    }

    //NOTE strictly env which we model ourselves on does not do value escaping which results in output
    // that cannot be sourced if the value contains spaces
    rv += `export ${key}=${escape_if_necessary(value)}\n`
  }

  // if (/\(pkgx\)/.test(getenv("PS1") ?? '') == false) {
  //   //FIXME doesn't work with warp.dev for fuck knows why reasons
  //   // https://github.com/warpdotdev/Warp/issues/3492
  //   rv += `export PS1="(pkgx) $PS1"\n`
  // }

  rv += `export PKGX_POWDER="${installations.pkgenv.map(utils.pkg.str).join(' ')}"\n`
  rv += `export PKGX_PKGENV="${installations.installations.map(({pkg}) => utils.pkg.str(pkg)).join(' ')}"\n\n`

  rv += "_pkgx_reset() {\n"
  for (const key in env) {
    const old = getenv(key)
    if (old !== undefined) {
      //TODO don’t export if not currently exported!
      rv += `  export ${key}=${escape_if_necessary(old)}\n`
    } else {
      rv += `  unset ${key}\n`
    }
  }

  // const ps1 = getenv('PS1')
  // rv += ps1 ? `  export PS1="${ps1}"\n` : "  unset PS1\n"
  // rv += "  unset -f _pkgx_reset\n"

  rv += "}\n"
  rv += "\n"

  const raw_off_string = rv_pkgenv.map(x => `-${utils.pkg.str(x)}`).join(' ')
  const off_string = rv_pkgenv.map(x => `-${escape_if_necessary(utils.pkg.str(x))}`).join(' ')

  rv += undent`
    _pkgx_should_deactivate_devenv() {
      suffix="\${PWD#"${dir}"}"
      test "$PWD" != "${dir}$suffix"
    }

    _pkgx_dev_off() {
      echo '${blurple('env')} ${raw_off_string}' >&2

      env ${off_string}

      if [ "$1" != --shy ]; then
        rm "${persistence}"
      fi

      unset -f _pkgx_dev_off _pkgx_should_deactivate_devenv

    `

  for (const key in userenv) {
    const value = getenv(key)
    if (value) {
      rv += `  export ${key}=${escape_if_necessary(value)}\n`
    } else {
      rv += `  unset ${key}\n`
    }
  }

  rv += "}"

  return [rv, rv_pkgenv] as [string, PackageRequirement[]]
}

function apply_userenv(env: Record<string, string>, userenv: Record<string, string>) {
  for (const [key, value] of Object.entries(userenv)) {
    if (!(key in env) && !value.includes(`$${key}`) && !value.includes(`\${${key}}`)) {
      /// user supplied env completely overrides this key or the key is empty
      env[key] = value
    } else {
      env[key] = value
        .replaceAll(`$${key}`, env[key])
        .replaceAll(`\${${key}}`, env[key])
    }
  }
}

export const _internals = {
  install,
  construct_env,
  datadir: () => hooks.useConfig().data,
  getenv: Deno.env.get,
  apply_userenv
}
