import { PackageRequirement,utils,semver } from "tea"
import { flatmap } from "tea/utils/misc.ts"

export default function in_active_pkgenv(pkg: PackageRequirement) {
  const pkgenv = flatmap(_internals.getenv("TEA_PKGENV"), x => x.split(" ")
    .map(utils.pkg.parse)
  ) ?? []
  for (const { project, constraint } of pkgenv) {
    if (project == pkg.project) {
      try {
        semver.intersect(pkg.constraint, constraint)
        return true
      } catch {
        return false
      }
    }
  }
}

export const _internals = {
  getenv: Deno.env.get,
}
