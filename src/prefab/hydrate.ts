import { PackageRequirement } from "../types.ts"


//TODO linktime cyclic dependencies cannot be allowed
//NOTE however if they aren’t link time it's presumably ok in some scenarios
//   eg a tool that lists a directory may depend on a tool that identifies the
//   mime types of files which could depend on the listing tool
//FIXME actually we are not refining the constraints currently


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

/// sorts a list of packages topologically based on their
/// dependencies. Throws if there is a cycle in the input.
/// ignores changes in dependencies based on versions
export default async function hydrate(
  dry: PackageRequirement[],
  get_deps: (pkg: PackageRequirement, dry: boolean) => Promise<PackageRequirement[]>,
): Promise<ReturnValue>
{
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
            bootstrap.add(dep.project)
          }
        } else {
          /// we already traced this graph
          const found = graph[dep.project]
          if (found && found.count() < node.count()) {
            found.parent = node
          } else if (!found) {
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
    if (pkg.project in graph) continue
    const new_node = new Node(pkg)
    graph[pkg.project] = new_node
    await go(new_node)
  }

  const pkgs = Object.values(graph)
    .sort((a, b) => b.count() - a.count())
    .map(({pkg}) => pkg)

  //TODO strictly we need to record precisely the bootstrap version constraint
  const bootstrap_required = new Set(pkgs.compactMap(({project}) => bootstrap.has(project) && project))

  return {
    pkgs,
    dry: pkgs.filter(({project}) =>  initial_set.has(project)),
    wet: pkgs.filter(({project}) => !initial_set.has(project) || bootstrap_required.has(project)),
    bootstrap_required
  }
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
