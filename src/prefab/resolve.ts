import { Package, PackageRequirement, semver } from "types"
import usePantry from "hooks/usePantry.ts"

/// contract there are no duplicate projects

export default async function resolve(reqs: PackageRequirement[]): Promise<Package[]> {
  const pantry = usePantry()
  const rv: Package[] = []
  for (const req of reqs) {
    const { project, constraint } = req
    const versions = await pantry.getVersions({ project, constraint })
    const version = semver.maxSatisfying(versions, constraint)
    if (!version) throw "no-version"
    rv.push({ version, project })
  }
  return rv
}
