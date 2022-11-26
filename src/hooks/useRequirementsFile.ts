import { isPlainObject, PlainObject } from "is_what"
import { PackageRequirement } from "../types.ts"
import { candidateType, RequirementsCandidate, RequirementsCandidateType } from "common/requirementsCandidate.ts"
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
  //TODO Add proper validation rather than an assertion
  const cType = candidateType(file.basename() as RequirementsCandidate)
  switch(cType) {
    case RequirementsCandidateType.TEA_YAML: 
    case RequirementsCandidateType.PACKAGE_JSON: return config_file(file, cType)
    case RequirementsCandidateType.README:    
    default:  return markdown(file)
  }
}

//TODO is this the config version or the project version?
//TODO what version should this be??
const CURRENT_CONFIG_VERSION = "1.0.0" as const

type configFile = {
  version: typeof CURRENT_CONFIG_VERSION,
  tea: {
    dependencies: Record<string, string>
  }
}

function config_file_is_valid(config: unknown, errorString: string): config is configFile {
  console.log("checking config file:", config)
  //TODO should we check for version in here?
  const presumedConfig = config as configFile
  if(!presumedConfig) return false
  if(!presumedConfig.tea) return false
  if(!isPlainObject(presumedConfig.tea))
    throw Error(`Bad ${errorString}, key: \`tea\` is not a valid object.`)
  if(!presumedConfig.tea.dependencies) return false
  if(!isPlainObject(presumedConfig.tea.dependencies))
    throw Error(`Bad ${errorString}, key: \`tea.dependencies\` is not a valid object.`)
  console.log("config is valid")
  return true
}

const parse_config = async (path: Path, candidateType: RequirementsCandidateType): Promise<configFile | undefined> => {
  const isYaml = candidateType === RequirementsCandidateType.TEA_YAML;
  const errorString = isYaml ? "yaml" : "json"
  const parsedObject = await (isYaml ? path.readYAML() : path.readJSON()) 
  if(config_file_is_valid(parsedObject, errorString)) return parsedObject
  return undefined
}

async function config_file(path: Path, candidateType: RequirementsCandidateType): Promise<RequirementsFile | undefined> {
  const config = await parse_config(path, candidateType)
  if(!config) return undefined
  const requirements = parsePackageRequirements(config.tea.dependencies)
  const version = new SemVer(config.version)
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
