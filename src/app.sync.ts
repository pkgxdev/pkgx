import useFlags, { Args } from "hooks/useFlags.ts"
import { install, link, resolve } from "prefab"
import { useSync, useVirtualEnv } from "hooks"

//TODO app.exec.ts and app.dump.ts should handle updating packages as part of their install logics

export default async function sync(opts: Args) {
  const { magic } = useFlags()

  // always sync pantry
  await useSync()

  const pkgs = [...opts.pkgs]

  if (opts.env) {
    pkgs.push(...(await useVirtualEnv()).pkgs)
  } else if (magic) {
    // TODO shouldn’t use magic if user has explicitly passed eg. a script path
    const blueprint = await useVirtualEnv().swallow(/^not-found/)
    if (blueprint) {
      pkgs.push(...blueprint.pkgs)
    }
  }

  if (pkgs.length) {
    for (const pkg of (await resolve(pkgs, { update: true })).pending) {
      const installation = await install(pkg)
      await link(installation)
    }
  }
}
