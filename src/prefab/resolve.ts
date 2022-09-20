// deno-lint-ignore-file no-cond-assign
import { Package, PackageRequirement, Installation } from "types"
import { useCellar, useInventory } from "hooks"
import * as semver from "semver"

/// NOTE resolves to bottles
/// NOTE contract there are no duplicate projects

export default async function resolve(reqs: PackageRequirement[]): Promise<Package[]> {
  const inventory = useInventory()
  const cellar = useCellar()
  const rv: Package[] = []
  let installation: Installation | undefined
  for (const req of reqs) {
    const { project, constraint } = req
    if (installation = await cellar.isInstalled(req)) {
      // if we have a version that matches this constraint installed then we use it
      rv.push(installation.pkg)
    } else {
      const versions = await inventory.getVersions({ project, constraint })
      const version = semver.maxSatisfying(versions, constraint)
      if (!version) { console.error({ project, constraint, versions }); throw new Error() }
      rv.push({ version, project })
    }
  }
  return rv
}
