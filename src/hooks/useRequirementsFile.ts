import { isPlainObject, PlainObject } from "is_what"
import { PackageRequirement } from "../types.ts"
import { flatmap } from "utils"
import Path from "../vendor/Path.ts"
import SemVer, * as semver from "semver"


export interface RequirementsFile {
  file: Path
  pkgs: PackageRequirement[]
  version?: SemVer
}

/// undefined if this file contains nothing we use to consider it a “requirements file”
//FIXME well, not doing this for markdown yet as would complicate code a lot
export default function useRequirementsFile(file: Path): Promise<RequirementsFile | undefined> {
  if (file.basename() == "package.json") {
    return package_json(file)
  } else {
    return markdown(file)
  }
}

async function package_json(path: Path): Promise<RequirementsFile | undefined> {
  const json = await path.readJSON()
  if (!isPlainObject(json)) throw new Error("bad-json")
  if (!json.tea) return
  const requirements = (() => {
    if (!json.tea.dependencies) return
    if (!isPlainObject(json.tea?.dependencies)) throw new Error("bad-json")
    return parsePackageRequirements(json.tea.dependencies)
  })()
  const version = flatmap(json.version, x => new SemVer(x))
  return { file: path, pkgs: requirements ?? [], version }
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

//TODO support windows newlines
//TODO use a markdown parser lol
async function markdown(path: Path): Promise<RequirementsFile | undefined> {
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

  return { file: path, pkgs: requirements ?? [], version }
}