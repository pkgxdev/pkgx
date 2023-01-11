import { install, link, resolve } from "prefab"
import { useSync } from "hooks"
import { VirtualEnv } from "hooks/useVirtualEnv.ts"
import { PackageSpecification } from "./types.ts"

//TODO app.exec.ts and app.dump.ts should handle updating packages as part of their install logics

export default async function sync(pkgs: PackageSpecification[], syringe?: VirtualEnv) {
  // always sync pantry
  await useSync()

  if (syringe) {
    pkgs.push(...syringe.pkgs)
  }

  if (pkgs.length) {
    for (const pkg of (await resolve(pkgs, { update: true })).pending) {
      const installation = await install(pkg)
      await link(installation)
    }
  }
}
