import { Package, PackageRequirement } from "types"
import SemVer, * as semver from "semver"

export function parse(input: string): PackageRequirement | Package {
  const match = input.match(/^(.*?)([\^=~<>@].+)?$/)
  if (!match) throw new Error()
  if (!match[2]) match[2] = "*"

  if (match[2].startsWith("@") || match[2].startsWith("=")) {
    return {
      project: match[1],
      version: new SemVer(match[2].replace(/^@/, ""))
    }
  } else {
    return {
      project: match[1],
      constraint: new semver.Range(match[2])
    }
  }
}

export function compare(a: Package, b: Package): number {
  return a.project === b.project
    ? a.version.compare(b.version)
    : a.project.localeCompare(b.project)
}

export function str(pkg: Package | PackageRequirement): string {
  if ("constraint" in pkg) {
    return `${pkg.project}@${pkg.constraint}`
  } else {
    return `${pkg.project}@${pkg.version}`
  }
}
