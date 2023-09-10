import { PackageRequirement, Path, TeaError, hooks, utils } from "tea"
import escape_if_necessary from "../utils/sh-escape.ts"
import construct_env  from "../prefab/construct-env.ts"
import install, { Logger } from "../prefab/install.ts"
import devenv from "../utils/devenv.ts"
import undent from "outdent"

export default async function(dir: Path, opts: { logger: Logger }) {
  const { install, construct_env, prefix, getenv } = _internals

  if (!dir.isDirectory()) {
    throw new TeaError(`not a directory: ${dir}`)
  }
  if (dir.eq(Path.home()) || dir.eq(Path.root)) {
    throw new TeaError(`refusing to activate: ${dir}`)
  }

  const { pkgs, env: userenv } = await devenv(dir)

  if (pkgs.length <= 0 && Object.keys(userenv).length <= 0) {
    throw new TeaError("no env")
  }

  /// indicate to our shell scripts that this devenv is activated
  const persistence = prefix().join(".local/var/devenv", dir.string.slice(1)).mkdir('p').join("xyz.tea.activated").touch()

  const installations = await install(pkgs, { update: false, ...opts })
  const env = await construct_env(installations)

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

  //FIXME doesn't work with warp.dev for fuck knows why reasons
  // https://github.com/warpdotdev/Warp/issues/3492
  rv += `export PS1="(tea) $PS1"\n\n`

  const off_string = installations.pkgenv.map(x => `-${utils.pkg.str(x)}`).join(' ')

  rv += undent`
    _tea_should_deactivate_devenv() {
      suffix="\${PWD#"${dir}"}"
      test "$PWD" != "${dir}$suffix"
    }

    _tea_deactivate() {
      echo 'tea ${off_string}' >&2

      export PS1="${getenv('PS1')}"

      if test "$1" != --shy; then
        rm "${persistence}"
      fi

      unset -f _tea_deactivate

    `

  for (const key in env) {
    const value = getenv(key)
    if (value !== undefined) {
      rv += `  export ${key}=${escape_if_necessary(value)}\n`
    } else {
      rv += `  unset ${key}\n`
    }
  }

  rv += "\n"
  rv += "  _tea_should_deactivate_devenv() {\n"
  rv += "    return 1\n"
  rv += "  }\n"
  rv += "}\n"

  return [rv, installations.pkgenv] as [string, PackageRequirement[]]
}

export const _internals = {
  install,
  construct_env,
  prefix: () => hooks.useConfig().prefix,
  getenv: Deno.env.get
}
