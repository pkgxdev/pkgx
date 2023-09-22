import { PackageSpecification, hooks, plumbing, Package } from "pkgx"
import { Logger as BaseLogger } from "pkgx/plumbing/install.ts"
import failsafe from "./failsafe.ts";

const { resolve, hydrate, install, link } = plumbing
const { usePantry } = hooks

export type Logger = {
  replace(string: string): void
  clear(): void
  upgrade(dry: PackageSpecification[], pending: Package[]): BaseLogger | undefined
}

export default async function(dry: PackageSpecification[], { logger, ...opts }: {
  update: boolean | Set<string>,
  logger: Logger
}) {
  logger.replace("resolving graph…")

  const { resolve, install, link, getproj, hydrate } = _internals

  const companions = (await Promise.all(dry.map(pkg => getproj(pkg).companions()))).flatMap(x => x)

  const { pkgs: wet, dry: pkgenv_ } = await failsafe(() => hydrate(dry.concat(companions)))
  const { pending, installed: installations } = await resolve(wet, opts)

  const superlogger = logger.upgrade(dry, pending)

  const installers = pending.map(pkg => install(pkg, superlogger).then(i => link(i).then(() => i)))
  installations.push(...await Promise.all(installers))

  logger.clear()

  const pkgenv = pkgenv_.filter(({project}) => companions.some(x => x.project == project) == false)

  return {
    installations,
    pkgenv
  }
}

export const _internals = {
  hydrate, resolve, install, link,
  getproj: usePantry().project
}
