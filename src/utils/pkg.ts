import { Package, PackageRequirement } from "types"
import * as semver from "semver"

/// allows inputs `nodejs.org@16` when `semver.parse` would reject
export function parse(input: string): PackageRequirement {
  const match = input.match(/^(.+?)([\^=~<>@].+)?$/)
  if (!match) throw new Error(`invalid pkgspec: ${input}`)
  if (!match[2]) match[2] = "*"

  const project = match[1]

  if (match[2] == "@latest") {
    return { project, constraint: new semver.Range('*') }
  } else {
    // @ is not a valid semver operator, but people expect it to work like so:
    // @5 => latest 5.x (ie ^5)
    // @5.1 => latest 5.1.x
    // @5.1.0 => latest 5.1.0 (usually 5.1.0 since most stuff hasn't got more digits)
    if (match[2].startsWith("@")) {
      const v = match[2].slice(1)
      const parts = v.split(".")
      const n = parts.length
      switch (n) {
      case 0:
        match[2] = `^${v}`
        break
      case 1:
        match[2] = `~${v}`
        break
      default: {
        const x = parseInt(parts.pop()!) + 1
        match[2] = `>=${v} <${parts.join('.')}.${x}`
      }}
    }

    const constraint = new semver.Range(match[2])
    return { project, constraint }
  }
}

export function compare(a: Package, b: Package): number {
  return a.project === b.project
    ? a.version.compare(b.version)
    : a.project.localeCompare(b.project)
}

export function str(pkg: Package | PackageRequirement): string {
  if (!("constraint" in pkg)) {
    return `${pkg.project}=${pkg.version}`
  } else if (pkg.constraint.set === "*") {
    return pkg.project
  } else {
    return `${pkg.project}${pkg.constraint}`
  }
}
