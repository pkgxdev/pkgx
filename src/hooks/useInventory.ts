import { PackageRequirement } from "types"
import { host } from "utils"
import SemVer, * as semver from "semver"

interface Response {
  getVersions(pkg: PackageRequirement): Promise<SemVer[]>
}

export interface Inventory {
  [project: string]: {
    [platform: string]: {
      [arch: string]: string[]
    }
  }
}

export default function useInventory(): Response {
  const getVersions = async ({ project, constraint }: PackageRequirement) => {
    const { platform, arch } = host()
    const url = `https://dist.tea.xyz/${project}/${platform}/${arch}/versions.txt`
    const rsp = await fetch(url)

    if (!rsp.ok) throw new Error(`404-not-found: ${url}`) //FIXME

    const releases = await rsp.text()

    return releases.split("\n").compact(vstr => {
      const v = new SemVer(vstr)
      if (semver.satisfies(v, constraint)) return v
    }, { rescue: true })
  }
  return { getVersions }
}
