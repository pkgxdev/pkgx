import { PackageRequirement, PkgxError, hooks } from "pkgx"
import parse_pkg_str from "../prefab/parse-pkg-str.ts"
import construct_env from "../prefab/construct-env.ts"
import { isString } from "deno/yaml/_utils.ts"
import install, { Logger } from "../prefab/install.ts"
import execve from "../utils/execve.ts"

export default async function(args: string[], opts: {
  update: boolean | Set<string>,
  pkgs: PackageRequirement[],
  logger: Logger
}) {
  const { exec, install, get_entrypoint, construct_env, chdir, parse_pkg_str } = _internals

  const pkg = await parse_pkg_str(args[0])
  const entrypoint = await get_entrypoint(pkg)
  if (!isString(entrypoint)) throw new NoEntrypointError(pkg)

  const pkgenv = await install([pkg, ...opts.pkgs], opts)

  args = entrypoint.split(/\s+/g).concat(args.slice(1))

  const path = pkgenv.installations.find(({pkg: {project}}) => project == pkg.project)?.path
  const env = await construct_env(pkgenv)

  chdir(path!.string)

  await exec({ cmd: args, env })
}

export const _internals = {
  install,
  exec,
  parse_pkg_str,
  construct_env,
  chdir: Deno.chdir,
  get_entrypoint: (pkg: { project: string }) => hooks.usePantry().project(pkg).yaml().then(x => x?.['entrypoint'])
}

function exec({ cmd, env }: {cmd: string[], env: Record<string, string>}) {
  if (Deno.build.os == 'windows') {
    // deno-lint-ignore no-deprecated-deno-api
    return Deno.run({ cmd, env, stdout: 'inherit', stderr: 'inherit' }).status()
  } else {
    return execve({ cmd, env })
  }
}

export class NoEntrypointError extends PkgxError {
  constructor(pkg: {project: string}) {
    super(`no entrypoint for: ${pkg.project}`)
  }
}
