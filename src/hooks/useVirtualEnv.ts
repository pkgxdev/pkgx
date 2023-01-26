import { flatmap, TeaError, validate_plain_obj } from "utils"
import { usePackageYAMLFrontMatter } from "hooks"
import { PackageRequirement } from "types"
import SemVer, * as semver from "semver"
import { PlainObject } from "is_what"
import { JSONC } from "jsonc"
import Path from "path"

export interface VirtualEnv {
  pkgs: PackageRequirement[]
  teafiles: Path[]
  srcroot: Path
  version?: SemVer
}

export default async function(cwd: Path = Path.cwd()): Promise<VirtualEnv> {
  let dir = cwd ?? Path.cwd()
  const home = Path.home()
  const pkgs: PackageRequirement[] = []
  const constraint = new semver.Range('*')
  const teafiles: Path[] = []
  const TEA_DIR = Deno.env.get("TEA_DIR")
  let version: SemVer | undefined
  let srcroot: Path | undefined
  let f: Path | undefined

  while (dir.neq(Path.root) && dir.neq(home)) {
    try {
      await supp(dir)
    } catch (err) {
      console.error(f)
      throw err
    }
    dir = dir.parent()
  }

  const lastd = teafiles.slice(-1)[0]?.parent()
  if (TEA_DIR) {
    srcroot = Path.cwd().join(TEA_DIR)
  } else if (!srcroot || lastd?.components().length < srcroot.components().length) {
    srcroot = lastd
  }

  if (!srcroot) throw new TeaError("not-found: dev-env", {cwd, TEA_DIR})

  return { pkgs, srcroot, teafiles, version }

  async function supp(dir: Path) {
    if (!dir.isDirectory()) throw new Error()

    const _if = (...names: string[]) => {
      for (const name of names) {
        if ((f = dir.join(name).isFile())) {
          teafiles.push(f)
          console.debug(f)
          return f
        }}}
    const _if_d = (...names: string[]) => {
      for (const name of names) {
        if ((f = dir.join(name).isDirectory())) {
          return f
        }}}
    const _if_md = (name: string) =>
      markdown_extensions.find(ext =>
        f = dir.join(`${name}.${ext}`).isFile())


    if (_if("deno.json", "deno.jsonc")) {
      pkgs.push({project: "deno.land", constraint})
      const json = validate_plain_obj(JSONC.parse(await f!.read()))
      pkgs.push(...parsePackageRequirements(json?.tea?.dependencies))
    }
    if (_if(".node-version")) {
      const constraint = semver.Range.parse((await f!.read()).trim())
      if (!constraint) throw new Error('couldn’t parse: .node-version')
      return [{ project: "nodejs.org", constraint }]
    }
    if (_if("package.json")) {
      const json = JSON.parse(await f!.read())
      const pkgs = parsePackageRequirements(json?.tea?.dependencies)
      const projects = new Set(pkgs.map(x => x.project))
      if (!projects.has("bun.sh")) {
        pkgs.push({project: "nodejs.org", constraint})
      }
      flatmap(semver.parse(json?.version), v => version = v)
    }
    if (_if("action.yml")) {
      const yaml = validate_plain_obj(await f!.readYAML())
      switch (yaml.runs?.using) {
        case "node16": return [{
          project: "nodejs.org",
          constraint: new semver.Range("^16")
        }]
        case "node12": return [{
          project: "nodejs.org",
          constraint: new semver.Range("^12")
        }]
      }}
    if (_if("cargo.toml")) {
      pkgs.push({project: "rust-lang.org", constraint})
      const foo = await usePackageYAMLFrontMatter(f!)
      if (foo) {
        pkgs.push(...foo.pkgs)
      }
      //TODO read the TOML too
    }
    if (_if("go.mod", "go.sum")) {
      pkgs.push({project: "go.dev", constraint})
      const foo = await usePackageYAMLFrontMatter(f!)
      if (foo) {
        pkgs.push(...foo.pkgs)
      }
    }
    if (_if("requirements.txt", "pipfile", "pipfile.lock", "setup.py")) {
      pkgs.push({project: "python.org", constraint})
      const foo = await usePackageYAMLFrontMatter(f!)
      if (foo) {
        pkgs.push(...foo.pkgs)
      }
    }
    if (_if("pyproject.toml")) {
      pkgs.push({project: "python-poetry.org", constraint})
      const foo = await usePackageYAMLFrontMatter(f!)
      if (foo) {
        pkgs.push(...foo.pkgs)
      }
    }
    if (_if("Gemfile")) {
      pkgs.push({project: "ruby-lang.org", constraint})
      const foo = await usePackageYAMLFrontMatter(f!)
      if (foo) {
        pkgs.push(...foo.pkgs)
      }
    }
    if (_if_md("README")) {
      const rv = await README(f!)
      pkgs.push(...rv.pkgs)
      if (rv.version) version = rv.version
      if (rv.version || rv.pkgs.length) {
        teafiles.push(f!)
      } else {
        // we still consider this a potential SRCROOT indicator
        srcroot = f!.parent()
      }
    }
    if (_if("package.yaml")) {
      //TODO check if package.yaml has been taken or not
      //TODO should be pacakge.yml like in pantry or what?
    }
    if (_if("VERSION")) {
      flatmap(semver.parse(await f!.read()), v => version = v)
    }
    if (_if_d(".git")) {
      pkgs.push({project: "git-scm.org", constraint})
      srcroot ??= f
    }
    if (_if_d(".hg", ".svn")) {
      srcroot ??= f
    }
  }

  function parsePackageRequirements(input: PlainObject): PackageRequirement[] {
    if (!input) return []
    const rv: PackageRequirement[] = []
    for (const [project, v] of Object.entries(input)) {
      const constraint = semver.Range.parse(v)
      if (!constraint) throw new Error(`could not parse: ${project}: ${v}`)
      rv.push({ project, constraint })
    }
    return rv
  }
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

export async function README(path: Path): Promise<{version?: SemVer, pkgs: PackageRequirement[]}> {
  const text = await path.read()
  const lines = text.split("\n")

  const findTable = (header: string) => {
    let prevline = ''
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
          //HACK so tea/clit itself doesn’t pick up the example table lol
          //FIXME use a real parser!
          if (prevline != '$ cat <<EOF >>my-project/README.md') {
            found = 'header'
          }
        }
      }
      prevline = line
    }
    return rows
  }

  const pkgs = (() => {
    return findTable("Dependencies")?.compact(([project, constraint]) => {
      if (project.startsWith("tea.xyz")) return //FIXME
      return {
        project,
        constraint: new semver.Range(constraint)
      }
    })
  })() ?? []

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

  return {version, pkgs}
}
