// deno-lint-ignore-file no-cond-assign
import { Package, PackageRequirement, Installation } from "types"
import { useCellar, useInventory } from "hooks"

/// NOTE resolves to bottles
/// NOTE contract there are no duplicate projects

export default async function resolve(reqs: (Package | PackageRequirement)[]): Promise<Package[]> {
  const inventory = useInventory()
  const cellar = useCellar()
  const rv: Package[] = []
  let installation: Installation | undefined
  for (const req of reqs) {
    if ("version" in req) {
      rv.push(req)
    } else if (installation = await cellar.has(req)) {
      // if something is already installed that satisfies the constraint then use it
      rv.push(installation.pkg)
    } else {
      const { project, constraint } = req
      const version = await inventory.select({ project, constraint })
      if (!version) {
        console.error({ project, constraint, version })
        throw new Error()
      }
      rv.push({ version, project })
    }
  }
  return rv
}
