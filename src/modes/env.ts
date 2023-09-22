import construct_env from "../prefab/construct-env.ts"
import install, { Logger } from "../prefab/install.ts"
import { PackageRequirement } from "pkgx"

export default async function({ pkgs, ...opts }: {
  pkgs: PackageRequirement[],
  update: boolean | Set<string>,
  logger: Logger
}) {
  const { install, construct_env } = _internals
  const installations = await install(pkgs, opts)
  const env = await construct_env(installations)
  return Object.entries(env).map(([key, value]) =>
    `${key}=${value}`
  ).join("\n")
}

export const _internals = {
  install, construct_env
}
