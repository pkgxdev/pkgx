// deno-lint-ignore-file no-cond-assign
import { PackageRequirement, Path, PlainObject, semver, SemVer } from "types"
import { flatMap, isPlainObject } from "utils"
import useFlags from "hooks/useFlags.ts"

//TODO
// determine srcroot by going up directories until we find a .git, .svn or .hg directory
// along the way read dependency files (README.md *not* package.json)
// remove specifying deno from ./scripts/* as it is duplication

export interface VirtualEnv {
  srcroot: Path
  requirements: PackageRequirement[]
  requirementsFile: Path
  version?: SemVer
}

export default async function useVirtualEnv(): Promise<VirtualEnv> {
  const { magic } = useFlags()

  console.debug(magic)

  if (!magic) {
    const reqs = extractFromJSON(Path.cwd().join("package.json"))
    if (!reqs) throw "package.json not found"
  }

  const srcroot = (() => {
    let dir = Path.cwd()
    while (dir.neq(Path.root)) {
      for (const vcs of [".git", ".svn", ".hg"]) {
        if (dir.join(vcs).isDirectory()) return dir
      }
      dir = dir.parent()
    }
    throw "not-found:srcroot"
  })()

  const attempt = async (filename: string, fn: (path: Path) => Promise<VirtualEnvSubset | undefined>) => {
    const requirementsFile = srcroot.join(filename).isFile()
    if (!requirementsFile) return
    const subset = await fn(requirementsFile)
    if (subset) return { ...subset, requirementsFile, srcroot }
  }

  let bp: VirtualEnv | undefined
  if (bp = await attempt("package.json", extractFromJSON)) return bp
  if (bp = await attempt("README.md", extractFromMarkdown)) return bp
  if (bp = await domagic(srcroot)) return bp

  throw "not-found:virtual-env"
}

type VirtualEnvSubset = Omit<VirtualEnv, 'srcroot' | 'requirementsFile'>

//TODO support windows newlines
//TODO use a markdown parser lol
async function extractFromMarkdown(path: Path): Promise<VirtualEnvSubset | undefined> {
  const text = await path.read()
  const lines = text.split("\n")

  const findTable = (header: string) => {
    const rows: [string, string][] = []
    let found: 'nope' | 'header' | 'table' = 'nope'
    done: for (const line of lines) {
      switch (found) {
      case 'header': {
        if (!line.trim()) continue
        if (line.match(/^\|\s*-+\s*\|\s*-+\s*\|(\s*-+\s*\|)?\s*$/)) found = 'table'
      } break
      case 'table': {
        const match = line.match(/^\|([^|]+)\|([^|]+)\|/)
        if (!match) break done
        rows.push([match[1].trim(), match[2].trim()])
      } break
      case 'nope':
        if (line.match(new RegExp(`^#+\\s*${header}\\s*$`))) {
          found = 'header'
        }
      }
    }
    return rows
  }

  const requirements = (() => {
    return findTable("Dependencies").compactMap(([project, constraint]) => {
      switch (project) {
      case "cc":
      case "c++":
      case "tea.xyz":
        return //FIXME
      default:
        return {
          project,
          constraint: new semver.Range(constraint)
        }
      }
    })
  })()

  const version = flatMap(
    findTable("Metadata").find(([key, value]) => key == "Version" && value),
    ([,x]) => new SemVer(x))

  return { requirements, version }
}

async function extractFromJSON(path: Path): Promise<VirtualEnvSubset | undefined> {
  const json = await path.readJSON()
  if (!isPlainObject(json)) throw "bad-json"
  if (!json.tea) return
  const requirements = (() => {
    if (!json.tea.dependencies) return []
    if (!isPlainObject(json.tea?.dependencies)) throw "bad-json"
    return parsePackageRequirements(json.tea.dependencies)
  })()
  const version = json.version
  return { requirements, version }
}

function parsePackageRequirements(input: PlainObject): PackageRequirement[] {
  const included = new Set<string>()
  const rv: PackageRequirement[] = []
  for (const [project, v] of Object.entries(input)) {
    if (included.has(project)) throw `duplicate-constraint:${project}`
    const rq: PackageRequirement = { project, constraint: new semver.Range(v.toString()) }
    rv.push(rq)
    console.verbose({ found: rq })
  }
  return rv
}

async function domagic(srcroot: Path): Promise<VirtualEnv | undefined> {
  let path: Path | undefined

  console.debug("doing:MAGIC")

  const requirements = await (async () => {
    if (path = srcroot.join("action.yml").isReadableFile()) {
      // deno-lint-ignore no-explicit-any
      const yaml = await path.readYAML() as any
      const using = yaml?.runs?.using
      switch (using) {
        case "node16": return [{
          project: "nodejs.org",
          constraint: new semver.Range("16")
        }]
        case "node12": return [{
          project: "nodejs.org",
          constraint: new semver.Range("12")
        }]
      }
    }
    if (path = srcroot.join(".node-version").isReadableFile()) {
      const constraint = new semver.Range(await path.read())
      return [{ project: "nodejs.org", constraint }]
    }
    if (path = srcroot.join("package.json").isReadableFile()) {
      return [{
        project: "nodejs.org",
        constraint: new semver.Range("*")
      }]
    }
  })()

  if (requirements) return {
    srcroot, requirements, requirementsFile: path!
  }
}
