import { Package, PackageRequirement, Installation } from "types"
import { useCellar, useInventory } from "hooks"
import { TeaError } from "utils"

/// NOTE resolves to bottles
/// NOTE contract there are no duplicate projects in input

interface RT {
  /// fully resolved list (includes both installed and pending)
  pkgs: Package[]

  /// already installed packages
  installed: Installation[]

  /// these are the pkgs that aren’t yet installed
  pending: Package[]
}

/// resolves a list of package specifications based on what is available in
/// bottle storage if `update` is false we will return already installed pkgs
/// that resolve so if we are resolving `node>=12`, node 13 is installed, but
/// node 19 is the latest we return node 13. if `update` is true we return node
/// 19 and *you will need to install it*.
export default async function resolve(reqs: (Package | PackageRequirement)[], {update}: {update: boolean} = {update: false}): Promise<RT> {
  const inventory = useInventory()
  const cellar = useCellar()
  const rv: RT = { pkgs: [], installed: [], pending: [] }
  let installation: Installation | undefined
  for (const req of reqs) {
    if (!update && (installation = await cellar.has(req))) {
      // if something is already installed that satisfies the constraint then use it
      rv.installed.push(installation)
      rv.pkgs.push(installation.pkg)
    } else {
      const version = await inventory.select(req)
      if (!version) {
        throw new TeaError("not-found: pkg.version", {pkg: req})
      }
      const pkg = { version, project: req.project }
      rv.pkgs.push(pkg)

      if ((installation = await cellar.has(pkg))) {
        rv.installed.push(installation)
      } else {
        rv.pending.push(pkg)
      }
    }
  }
  return rv
}
