import { PackageRequirement, Package } from "types"
import { isArray } from "is_what"
import * as semver from "semver"
import { usePantry } from "hooks"
import "utils"


//TODO linktime cyclic dependencies cannot be allowed
//NOTE however if they aren’t link time it's presumably ok in some scenarios
//   eg a tool that lists a directory may depend on a tool that identifies the
//   mime types of files which could depend on the listing tool
//FIXME actually we are not refining the constraints currently
//TODO we are not actually restricting subsequent asks, eg. deno^1 but then deno^1.2


interface ReturnValue {
  /// full list topologically sorted (ie dry + wet)
  pkgs: PackageRequirement[]

  /// your input, but version constraints refined based on the whole graph
  /// eg. you hydrate the graph for a and b, but b depends on a tighter range of a than you input
  dry: PackageRequirement[]

  /// packages that were not supplied to input or that require bootstrap
  wet: PackageRequirement[]

  /// the graph cycles at these packages
  /// this is only a problem if you need to build one of these,
  // in which case TADA! here's the list!
  bootstrap_required: Set<string>
}

const get = (x: PackageRequirement) => usePantry().getDeps(x).then(x => x.runtime)

/// sorts a list of packages topologically based on their
/// dependencies. Throws if there is a cycle in the input.
/// ignores changes in dependencies based on versions
export default async function hydrate(
  input: (PackageRequirement | Package)[] | (PackageRequirement | Package),
  get_deps: (pkg: PackageRequirement, dry: boolean) => Promise<PackageRequirement[]> = get,
): Promise<ReturnValue>
{
  if (!isArray(input)) input = [input]

  const dry = condense(input.map(spec => {
    if ("version" in spec) {
      return {project: spec.project, constraint: new semver.Range(`=${spec.version}`)}
    } else {
      return spec
    }
  }))

  const graph: Record<string, Node> = {}
  const bootstrap = new Set<string>()
  const initial_set = new Set(dry.map(x => x.project))

  const go = async (target: Node) => {
    /// we trace up a target pkg’s dependency graph
    /// the target pkg is thus the youngest child and we are ascending up its parents
    const ascend = async (node: Node, children: Set<string>) => {

      for (const dep of await get_deps(node.pkg, initial_set.has(node.project))) {

        if (children.has(dep.project)) {
          if (!bootstrap.has(dep.project)) {
            console.warn(`${dep.project} must be bootstrapped to build ${node.project}`)

            //TODO the bootstrap should keep the version constraint since it may be different
            bootstrap.add(dep.project)
          }
        } else {
          const found = graph[dep.project]
          if (found) {
            /// we already traced this graph

            if (found.count() < node.count()) {
              found.parent = node
            }

            //FIXME strictly we only have to constrain graphs that contain linkage
            // ie. you cannot have a binary that links two separate versions of eg. openssl
            // or (maybe) services, eg. you might suffer if there are two versions of postgres running (though tea mitigates this)
            found.pkg.constraint = semver.intersect(found.pkg.constraint, dep.constraint)

          } else {
            const new_node = new Node(dep, node)
            graph[dep.project] = new_node
            await ascend(new_node, new Set([...children, dep.project]))
          }
        }
      }
    }
    await ascend(target, new Set<string>([target.project]))
  }

  for (const pkg of dry) {
    if (pkg.project in graph) {
      graph[pkg.project].pkg.constraint = semver.intersect(graph[pkg.project].pkg.constraint, pkg.constraint)
    } else {
      const new_node = new Node(pkg)
      graph[pkg.project] = new_node
      await go(new_node)
    }
  }

  const pkgs = Object.values(graph)
    .sort((a, b) => b.count() - a.count())
    .map(({pkg}) => pkg)

  //TODO strictly we need to record precisely the bootstrap version constraint
  const bootstrap_required = new Set(pkgs.compact(({project}) => bootstrap.has(project) && project))

  return {
    pkgs,
    dry: pkgs.filter(({project}) =>  initial_set.has(project)),
    wet: pkgs.filter(({project}) => !initial_set.has(project) || bootstrap_required.has(project)),
    bootstrap_required
  }
}

function condense(pkgs: PackageRequirement[]) {
  const out: PackageRequirement[] = []
  for (const pkg of pkgs) {
    const found = out.find(x => x.project === pkg.project)
    if (found) {
      found.constraint = semver.intersect(found.constraint, pkg.constraint)
    } else {
      out.push(pkg)
    }
  }
  return out
}


/////////////////////////////////////////////////////////////////////////// lib
class Node {
  parent: Node | undefined
  readonly pkg: PackageRequirement
  readonly project: string

  constructor(pkg: PackageRequirement, parent?: Node) {
    this.parent = parent
    this.pkg = pkg
    this.project = pkg.project
  }

  count(): number {
    let n = 0
    let node = this as Node | undefined
    // deno-lint-ignore no-cond-assign
    while (node = node?.parent) n++
    return n
  }
}
