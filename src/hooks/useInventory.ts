import { Package, PackageRequirement } from "types"
import { host, error } from "utils"
import SemVer from "semver"
import Path from "../vendor/Path.ts"

export interface Inventory {
  [project: string]: {
    [platform: string]: {
      [arch: string]: string[]
    }
  }
}

const select = async (rq: PackageRequirement | Package) => {
  const { platform, arch } = host()

  const url = new URL('https://dist.tea.xyz')
  url.pathname = Path.root.join(rq.project, platform, arch, 'versions.txt').string

  const rsp = await fetch(url)

  if (!rsp.ok) throw new Error(`404-not-found: ${url}`) //FIXME

  const releases = await rsp.text()
  const versions = releases.split("\n").map(x => new SemVer(x))

  if (versions.length < 1) throw new Error()

  console.debug({ project: rq.project, versions })

  if ("constraint" in rq) {
    return rq.constraint.max(versions)
  } else if (versions.find(x => x.eq(rq.version))) {
    return rq.version
  }
}

export default function useInventory() {
  return { select: error.wrap(select, 'http') }
}
