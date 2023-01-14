// deno-lint-ignore-file no-cond-assign
import useRequirementsFile, { RequirementsFile } from "./useRequirementsFile.ts"
import { PackageRequirement } from "types"
import SemVer, * as semver from "semver"
import { flatmap, TeaError } from "utils"
import Path from "path"

//CONSIDER
// add requirementsFiles from CWD down to srcroot

export interface VirtualEnv {
  pkgs: PackageRequirement[]
  file: Path
  srcroot: Path
  version?: SemVer
}

const markdown_extensions = [
  "md",
  'mkd',
  'mdwn',
  'mdown',
  'mdtxt',
  'mdtext',
  'markdown',
  'text',
  'md.txt'
]

function find({cwd}: {cwd?: Path} = {cwd: undefined}) {
  const TEA_DIR = Deno.env.get("TEA_DIR")
  if (TEA_DIR) return Path.cwd().join(TEA_DIR)

  let dir = cwd ?? Path.cwd()
  const home = Path.home()
  while (dir.neq(Path.root) && dir.neq(home)) {
    for (const vcs of [".git", ".svn", ".hg"]) {
      if (dir.join(vcs).isDirectory()) return dir
    }
    dir = dir.parent()
  }
}

export default async function useVirtualEnv(opts?: { cwd: Path }): Promise<VirtualEnv> {
  const ctx = {
    cwd: opts?.cwd ?? Path.cwd(),
    TEA_DIR: Deno.env.get("TEA_DIR")
  }

  const srcroot = find(opts)
  if (!srcroot) throw new TeaError("not-found: srcroot", ctx)

  const files: RequirementsFile[] = await (async () => {
    const rv: RequirementsFile[] = []
    const basenames = ["package.json", ...markdown_extensions.map(x => `README.${x}`)]
    for (const basename of basenames) {
      const path = srcroot.join(basename).isFile()
      if (!path) continue
      const rf = await useRequirementsFile(path)
      if (rf) rv.push(rf)
    }
    return rv
  })()

  if (files.length < 1) throw new TeaError("not-found: virtual-env", ctx)

  const { file, version: version_README } = files.find(x => x.file.basename() == "README.md") ?? files[0]

  const version = flatmap(srcroot.join("VERSION").isFile(), x => semver.parse(x.string)) ?? version_README

  const pkgs = files.flatMap(x => x.pkgs)

  //TODO anything from here should not conflict with more explicit deps
  pkgs.push(...await implicit_env(srcroot))

  return {
    pkgs,
    file,
    srcroot,
    version
  }
}

//TODO get version too
async function implicit_env(srcroot: Path): Promise<PackageRequirement[]> {
  let path: Path | undefined

  //TODO don’t stop if we find something, keep adding all deps

  const requirements = await (async () => {
    if (path = srcroot.join("action.yml").isReadableFile()) {
      // deno-lint-ignore no-explicit-any
      const yaml = await path.readYAML() as any
      const using = yaml?.runs?.using
      switch (using) {
        case "node16": return [{
          project: "nodejs.org",
          constraint: new semver.Range("^16")
        }]
        case "node12": return [{
          project: "nodejs.org",
          constraint: new semver.Range("^12")
        }]
      }
    }
    if (path = srcroot.join(".node-version").isReadableFile()) {
      const constraint = parse(await path.read())
      return [{ project: "nodejs.org", constraint }]
    }
    if (path = srcroot.join("package.json").isReadableFile()) {
      return [{
        project: "nodejs.org",
        constraint: new semver.Range("*")
      }]
    }
    return []
  })()

  return requirements
}

function parse(input: string): semver.Range {
  if (/^\d/.test(input)) {
    input = `^${input}`
  }
  return new semver.Range(input)
}
