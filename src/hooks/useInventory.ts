import { RELOAD_POLICY } from "mxcl/deno-cache";
import { PackageRequirement, semver, SemVer } from "types"
import { GET } from "utils"
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
    const releases = await GET<Inventory>(`https://s3.amazonaws.com/dist.tea.xyz/versions.json`, RELOAD_POLICY)

    return releases[project]?.[platform]?.[arch]?.compactMap((version: string) => {
      if (semver.satisfies(version, constraint)) { return semver.parse(version) }
    })
  }
  return { getVersions }
}
