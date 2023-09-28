import { PackageRequirement, Path, TeaError, hooks, utils } from "tea"
import escape_if_necessary from "../utils/sh-escape.ts"
import construct_env  from "../prefab/construct-env.ts"
import install, { Logger } from "../prefab/install.ts"
import { teal } from "../utils/color.ts"
import devenv from "../utils/devenv.ts"
import undent from "outdent"

export default async function(dir: Path, { powder, ...opts }: { powder: PackageRequirement[], logger: Logger }) {
  const { install, construct_env, prefix, getenv } = _internals

  if (!dir.isDirectory()) {
    throw new TeaError(`not a directory: ${dir}`)
  }
  if (dir.eq(Path.home()) || dir.eq(Path.root)) {
    throw new TeaError(`refusing to activate: ${dir}`)
  }

  const { pkgs, env: userenv } = await devenv(dir)

  const devenv_pkgs = [...pkgs]
  pkgs.push(...powder)

  if (pkgs.length <= 0 && Object.keys(userenv).length <= 0) {
    throw new TeaError("no env")
  }

  /// indicate to our shell scripts that this devenv is activated
  const persistence = prefix().join(".local/var/devenv", dir.string.slice(1)).mkdir('p').join("xyz.tea.activated").touch()

  const installations = await install(pkgs, { update: false, ...opts })
  const env = await construct_env(installations)

  /// we only want to tell the user about NEW packages added to the env
  const rv_pkgenv = (installed => {
    const set = new Set(devenv_pkgs.map(({project}) => project))
    return installed.filter(x => set.has(x.project))
  })(installations.pkgenv)

  let rv = ''

  /// env specified in devenv files takes precedence
  Object.assign(env, userenv)

  for (let [key, value] of Object.entries(env)) {

    const existing_value = getenv(key)
    if (value == existing_value) {
      delete env[key]
      continue
    }
    // we ignore /FLAGS$/ due to lack of better way to determine keys that should not be colon separated
    if (existing_value !== undefined && !key.endsWith("FLAGS")) {
      value += `:$${key}`  // indeed we rely on the shell to expand for clarity and to make this shellcode portable
    }

    //NOTE strictly env which we model ourselves on does not do value escaping which results in output
    // that cannot be sourced if the value contains spaces
    rv += `export ${key}=${escape_if_necessary(value)}\n`
  }

  // if (/\(tea\)/.test(getenv("PS1") ?? '') == false) {
  //   //FIXME doesn't work with warp.dev for fuck knows why reasons
  //   // https://github.com/warpdotdev/Warp/issues/3492
  //   rv += `export PS1="(tea) $PS1"\n`
  // }

  rv += `export TEA_POWDER="${installations.pkgenv.map(utils.pkg.str).join(' ')}"\n`
  rv += `export TEA_PKGENV="${installations.installations.map(({pkg}) => utils.pkg.str(pkg)).join(' ')}"\n\n`

  rv += "_tea_reset() {\n"
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
  // rv += "  unset -f _tea_reset\n"
  // rv += "}\n"

  rv += "\n"

  const raw_off_string = rv_pkgenv.map(x => `-${utils.pkg.str(x)}`).join(' ')
  const off_string = rv_pkgenv.map(x => `-${escape_if_necessary(utils.pkg.str(x))}`).join(' ')

  rv += undent`
    _tea_should_deactivate_devenv() {
      suffix="\${PWD#"${dir}"}"
      test "$PWD" != "${dir}$suffix"
    }

    _tea_dev_off() {
      echo '${teal('tea')} ${raw_off_string}' >&2

      tea ${off_string}

      if [ "$1" != --shy ]; then
        rm "${persistence}"
      fi

      unset -f _tea_dev_off _tea_should_deactivate_devenv

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

export const _internals = {
  install,
  construct_env,
  prefix: () => hooks.useConfig().prefix,
  getenv: Deno.env.get
}
