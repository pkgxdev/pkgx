import { Package, PackageRequirement } from "types"
import * as semver from "semver"

/// allows inputs `nodejs.org@16` when `semver.parse` would reject
export function parse(input: string): PackageRequirement {
  const match = input.match(/^(.+?)([\^=~<>@].+)?$/)
  if (!match) throw new Error(`invalid pkgspec: ${input}`)
  if (!match[2]) match[2] = "*"

  const project = match[1]

  if (match[2] =="@latest") {
    console.warn(`@latest is deprecated, instead specify \`${project}*' or just \`${project}'`)
    return { project, constraint: new semver.Range('*') }
  } else {
    // everyone expects `@` and for it to work this way
    if (match[2].startsWith("@")) match[2] = `^${match[2].slice(1)}`

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
