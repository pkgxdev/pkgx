import { PackageRequirement, semver, semver_intersection } from "types"
import usePantry from "hooks/usePantry.ts"

/// recurses a set of package requirements hydrating the full graph (if possible)

export default async function hydrate(reqs: PackageRequirement[]): Promise<PackageRequirement[]> {
  const pantry = usePantry()
  const stack = [...reqs]
  const rv: PackageRequirement[] = []
  const set: Record<string, semver.Range> = {}

  while (stack.length > 0) {
    const curr = stack.shift()!

    for (const dep of await pantry.getDeps({ pkg: curr })) {
      if (dep.project in set) {
        const intersection = semver_intersection(set[dep.project]!, dep.constraint)
        // ^^ throws if no intersection possible
        set[dep.project] = intersection
        // ^^ adjust our constraint
      } else {
        stack.unshift(dep)
        set[dep.project] = dep.constraint
      }
    }

    rv.push(curr)
  }

  return rv
}
