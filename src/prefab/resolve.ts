// deno-lint-ignore-file no-cond-assign
import { Package, PackageRequirement, Installation } from "types"
import { useCellar, useInventory } from "hooks"

/// NOTE resolves to bottles
/// NOTE contract there are no duplicate projects

interface RT {
  pkgs: Package[]
  /// some of the pkgs may already be installed
  /// if so they are in here
  installed: Installation[]

  /// these are the pkgs that aren’t yet installed
  pending: Package[]
}

export default async function resolve(reqs: (Package | PackageRequirement)[]): Promise<RT> {
  const inventory = useInventory()
  const cellar = useCellar()
  const rv: RT = { pkgs: [], installed: [], pending: [] }
  let installation: Installation | undefined
  for (const req of reqs) {
    if (installation = await cellar.has(req)) {
      // if something is already installed that satisfies the constraint then use it
      rv.installed.push(installation)
      rv.pkgs.push(installation.pkg)
    } else {
      const version = await inventory.select(req)
      if (!version) {
        console.error({ ...req, version })
        throw new Error("no bottle available")
      }
      const pkg = { version, project: req.project }
      rv.pkgs.push(pkg)
      rv.pending.push(pkg)
    }
  }
  return rv
}
