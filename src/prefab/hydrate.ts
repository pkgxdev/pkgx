import { PackageRequirement, semver, semver_intersection } from "types"
import { _get_deps } from "./hydrate-topological.ts"

/// recurses a set of package requirements hydrating the full graph (if possible)
/// return is NOT topologically sorted
/// NOTE this is way faster than a topological sort
// FIXME we should always topologically sort, it's just our algo is crap

export default async function hydrate(
  reqs: PackageRequirement[],
  get_deps = _get_deps
): Promise<PackageRequirement[]> {

  const stack = [...reqs]

  const constraints: Record<string, semver.Range> = {}
  for (const pkg of stack) {
    constraints[pkg.project] = pkg.constraint
  }

  while (stack.length > 0) {
    const pkg = stack.shift()!

    for (const dep of await get_deps(pkg)) {

      if (dep.project in constraints) {
        constraints[dep.project] = semver_intersection(constraints[dep.project]!, dep.constraint)
      } else {
        constraints[dep.project] = dep.constraint
        // we need to process this package
        stack.push(dep)
      }
    }
  }

  return Object.entries(constraints)
    .map(([project, constraint]) => ({project, constraint}))
}
