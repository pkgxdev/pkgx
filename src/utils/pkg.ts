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
    match[2] = match[2].replace(",", " || ")
    match[2] = match[2].replace(/(\d)</, '$1 <')
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
    if (pkg.constraint.raw === "*") return pkg.project

    const parts = pkg.constraint.set.map(([low, high]) => {
      /// in this case actually we're a precise version
      if (!high && low.operator === "") return `@${low.semver.toString()}`

      if (low.operator !== ">=") throw new Error("unimplemented")
      if (high) {
        if (high.operator !== '<' && high.semver.major !== low.semver.major + 1) {
          throw new Error("unimplemented")
        }
        if (high.semver.minor !== 0 || high.semver.patch !== 0) {
          // we remove spaces so we are command line safe
          return `>=${low.semver.toString()}<${high.semver.toString()}`
        }
      } else {
        return `>=${low.semver.toString()}`
      }
      if (low.semver.patch) {
        return `^${low.semver.major}.${low.semver.minor}.${low.semver.patch}`
      } else if (low.semver.minor) {
        return `^${low.semver.major}.${low.semver.minor}`
      } else {
        return `^${low.semver.major}`
      }
    })
    return `${pkg.project}${parts.join(',')}`
  } else {
    return `${pkg.project}@${pkg.version.toString()}`
  }
}
