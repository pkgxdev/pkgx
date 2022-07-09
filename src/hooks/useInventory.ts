import { PackageRequirement, semver, SemVer } from "types"
import usePlatform from "./usePlatform.ts";

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
    const { platform, arch } = usePlatform()
    const url = `https://s3.amazonaws.com/dist.tea.xyz/${project}/${platform}/${arch}/versions.txt`
    const rsp = await fetch(url)

    if (!rsp.ok) throw new Error(`404-not-found: ${url}`) //FIXME

    const releases = await rsp.text()

    return releases.split("\n").compactMap((version: string) => {
      if (semver.satisfies(version, constraint)) { return semver.parse(version) }
    })
  }
  return { getVersions }
}
