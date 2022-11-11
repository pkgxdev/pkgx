// deno-lint-ignore-file no-cond-assign
import { PackageRequirement } from "types"
import { flatmap, TeaError } from "utils"
import { isPlainObject, PlainObject } from "is_what"
import { useFlags } from "hooks"
import SemVer, * as semver from "semver"
import Path from "path"

//TODO
// determine srcroot by going up directories until we find a .git, .svn or .hg directory
// along the way read dependency files (README.md *not* package.json)
// remove specifying deno from ./scripts/* as it is duplication

export interface VirtualEnv {
  srcroot: Path
  requirements: PackageRequirement[]
  requirementsFile: Path  //NOTE maybe incorrect
  version?: SemVer
}

function TEA_DIR() {
  return flatmap(Deno.env.get("TEA_DIR"), x => new Path(x)) ?? Path.cwd()
}

export default async function useVirtualEnv({ cwd }: { cwd: Path } = { cwd: TEA_DIR() }): Promise<VirtualEnv> {
  const { magic } = useFlags()

  if (!magic) {
    const reqs = extractFromJSON(cwd.join("package.json"))
    if (!reqs) throw new Error("package.json not found")
  }

  const srcroot = (() => {
    if (Deno.env.get("TEA_DIR")) {
      return new Path(Deno.env.get("TEA_DIR")!)
    }

    let dir = cwd
    const home = Path.home()
    while (dir.neq(Path.root) && dir.neq(home)) {
      for (const vcs of [".git", ".svn", ".hg"]) {
        if (dir.join(vcs).isDirectory()) return dir
      }
      dir = dir.parent()
    }
    throw new Error("not-found:srcroot")
  })()

  const attempt = async (filename: string, fn: (path: Path) => Promise<VirtualEnvSubset | undefined>) => {
    const requirementsFile = srcroot.join(filename).isFile()
    if (!requirementsFile) return
    const subset = await fn(requirementsFile)
    if (subset) {
      const requirements = subset.requirements ?? await domagic(srcroot) ?? []
      return { ...subset, requirements, requirementsFile, srcroot }
    }
  }

  let bp: VirtualEnv | undefined
  if (bp = await attempt("package.json", extractFromJSON)) return bp
  if (bp = await attempt("README.md", extractFromMarkdown)) return bp

  const requirements = await domagic(srcroot)
  if (requirements) return {
    requirements,
    requirementsFile: srcroot.join(".null"),
    srcroot
  }

  throw new TeaError('not-found: virtual-env', { cwd })
}

type VirtualEnvSubset = {
  requirements: PackageRequirement[] | undefined
  version: SemVer | undefined
}

//TODO support windows newlines
//TODO use a markdown parser lol
async function extractFromMarkdown(path: Path): Promise<VirtualEnvSubset | undefined> {
  const text = await path.read()
  const lines = text.split("\n")

  const findTable = (header: string) => {
    let rows: [string, string][] | undefined = undefined
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
        if (!rows) rows = []
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
    return findTable("Dependencies")?.compact(([project, constraint]) => {
      if (project.startsWith("tea.xyz")) return //FIXME
      return {
        project,
        constraint: new semver.Range(constraint)
      }
    })
  })()

  const fromMetadataTable = () => flatmap(
    findTable("Metadata")?.find(([key, value]) => key.toLowerCase() == "version" && value),
    ([,x]) => new SemVer(x)
  )

  const fromFirstHeader = () => {
    for (let line of lines) {
      line = line.trim()
      if (/^#+/.test(line)) {
        const match = line.match(new RegExp(`v?(${semver.regex.source})$`))
        if (match) {
          return new SemVer(match[1])
        } else {
          return  // we only check the first header
        }
      }
    }
  }

  const version = fromMetadataTable() ?? fromFirstHeader()

  return { requirements, version }
}

async function extractFromJSON(path: Path): Promise<VirtualEnvSubset | undefined> {
  const json = await path.readJSON()
  if (!isPlainObject(json)) throw new Error("bad-json")
  if (!json.tea) return
  const requirements = (() => {
    if (!json.tea.dependencies) return
    if (!isPlainObject(json.tea?.dependencies)) throw new Error("bad-json")
    return parsePackageRequirements(json.tea.dependencies)
  })()
  const version = flatmap(json.version, x => new SemVer(x))
  return { requirements, version }
}

function parsePackageRequirements(input: PlainObject): PackageRequirement[] {
  const included = new Set<string>()
  const rv: PackageRequirement[] = []
  for (const [project, v] of Object.entries(input)) {
    if (included.has(project)) throw new Error(`duplicate-constraint:${project}`)
    const rq: PackageRequirement = { project, constraint: new semver.Range(v.toString()) }
    rv.push(rq)
    console.verbose({ found: rq })
  }
  return rv
}

//TODO get version too
async function domagic(srcroot: Path): Promise<PackageRequirement[] | undefined> {
  let path: Path | undefined

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

  return requirements
}
