import { PackageRequirement, semver, semver_intersection } from "types"
import usePantry from "hooks/usePantry.ts"

/// recurses a set of package requirements hydrating the full graph (if possible)
/// return is topologically sorted

// FIXME inefficient

const pantry = usePantry()

export default async function hydrate(
  reqs: PackageRequirement[],
  get_deps = (pkg: PackageRequirement) => pantry.getDeps(pkg).then(x => x.runtime)
): Promise<PackageRequirement[]> {

  const stack: [PackageRequirement, number][] = reqs.map(x => [x, 0])
  const counts: Record<string, number> = {}
  const constraints: Record<string, semver.Range> = {}

  for (const { project, constraint } of reqs) {
    constraints[project] = constraint
    counts[project] = 0
  }

  while (stack.length > 0) {
    const [pkg, n] = stack.shift()!

    for (const dep of await get_deps(pkg)) {

      /// avoid infinite cycles until we understand “bootstrap” projects
      if (dep.project == 'llvm.org' || dep.project == 'gnu.org/make') continue

      if (dep.project in constraints) {
        constraints[dep.project] = semver_intersection(constraints[dep.project]!, dep.constraint)
      } else {
        constraints[dep.project] = dep.constraint
      }
      if ((counts[dep.project] ?? 0) <= n) {
        counts[dep.project] = n + 1
        stack.push([dep, n + 1])
        //FIXME ^^ inefficient, we already calculated this, but we need to redo
        // this tree since we've encountered it at a larger depth
      }
    }
  }

//FIXME  console.debug(counts)

  return Object.entries(counts)
    .sort(([,a], [,b]) => a < b ? 1 : a > b ? -1 : 0)
    .map(([project]) => {
      const constraint = constraints[project]
      return {project, constraint}
    })
}
