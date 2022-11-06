import { Package, PackageRequirement } from "types"
import { host } from "utils"
import SemVer from "semver"
import { wrap } from "../utils/error.ts"

export interface Inventory {
  [project: string]: {
    [platform: string]: {
      [arch: string]: string[]
    }
  }
}

const select = async (rq: PackageRequirement | Package) => {
  const { platform, arch } = host()
  const url = `https://dist.tea.xyz/${rq.project}/${platform}/${arch}/versions.txt`
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
  return { select: wrap(select, 'http') }
}
