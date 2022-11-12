import useFlags, { Args } from "hooks/useFlags.ts"
import { install, link, resolve } from "prefab"
import { useSync, useVirtualEnv } from "hooks"
import { Logger } from "./hooks/useLogger.ts"

export default async function sync(opts: Args) {
  const { magic } = useFlags()

  // always sync pantry
  await useSync()

  const pkgs = opts.pkgs

  if (opts.env) {
    pkgs.push(...(await useVirtualEnv()).requirements)
  } else if (magic) {
    // TODO shouldn’t use magic if user has explicitly passed eg. a script path
    const blueprint = await useVirtualEnv().swallow(/^not-found/)
    if (blueprint) {
      pkgs.push(...blueprint.requirements)
    }
  }

  if (pkgs.length) {
    for (const pkg of (await resolve(pkgs, { update: true })).pending) {
      const logger = new Logger()
      const installation = await install(pkg, logger)
      await link(installation)
    }
  }
}
