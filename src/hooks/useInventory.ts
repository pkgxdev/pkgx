import { PackageRequirement } from "types"
import { host } from "utils"
import SemVer from "semver"

export interface Inventory {
  [project: string]: {
    [platform: string]: {
      [arch: string]: string[]
    }
  }
}

const select = async ({ project, constraint }: PackageRequirement) => {
  const { platform, arch } = host()
  const url = `https://dist.tea.xyz/${project}/${platform}/${arch}/versions.txt`
  const rsp = await fetch(url)

  if (!rsp.ok) throw new Error(`404-not-found: ${url}`) //FIXME

  const releases = await rsp.text()
  const versions = releases.split("\n").map(x => new SemVer(x))

  console.debug({ project, versions })

  return constraint.max(versions)
}

export default function useInventory() {
  return { select }
}
