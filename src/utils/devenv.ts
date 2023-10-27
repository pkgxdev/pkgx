import { PlainObject, isArray, isNumber, isPlainObject, isString } from "is-what"
import { PackageRequirement, Path, semver, hooks, utils } from "pkgx"
import { validatePackageRequirement } from "pkgx/hooks/usePantry.ts"
import { parse as parseYaml } from "deno/yaml/parse.ts"
import parse_pkg_str from "../prefab/parse-pkg-str.ts"
import { readLines } from "deno/io/read_lines.ts"
import { ProgrammerError } from "./error.ts"
import * as JSONC from "deno/jsonc/mod.ts"
const { useMoustaches } = hooks

export default async function(dir: Path) {
  if (!dir.isDirectory()) {
    throw new ProgrammerError(`not a directory: ${dir}`)
  }

  const constraint = new semver.Range('*')
  let has_package_json = false

  const pkgs: PackageRequirement[] = []
  const env: Record<string, string> = {}

  for await (const [path, {name, isFile, isDirectory}] of dir.ls()) {
    if (isFile) {
      switch (name) {
      case "deno.json":
      case "deno.jsonc":
        await deno(path)
        break
      case ".nvmrc":
      case ".node-version":
        await version_file(path, 'nodejs.org')
        break
      case ".ruby-version":
        await version_file(path, 'ruby-lang.org')
        break
      case ".python-version":
        await python_version(path)
        break
      case ".terraform-version":
        await terraform_version(path)
        break
      case "package.json":
        await package_json(path)
        break
      case "action.yml":
      case "action.yaml":
        await github_actions(path)
        break
      case "Cargo.toml":
        pkgs.push({project: "rust-lang.org", constraint})
        await read_YAML_FM(path)  //TODO use dedicated TOML section in preference
        break
      case "skaffold.yaml":
        pkgs.push({project: "skaffold.dev", constraint})
        await skaffold_yaml(path)
        break
      case "go.mod":
      case "go.sum":
        pkgs.push({project: "go.dev", constraint})
        await read_YAML_FM(path)
        break
      case "requirements.txt":
      case "pipfile":
      case "pipfile.lock":
      case "setup.py":
        pkgs.push({project: "pip.pypa.io", constraint})
        await read_YAML_FM(path)
        break
      case "pyproject.toml":
        await pyproject(path)
        break
      case "Gemfile":
        pkgs.push({project: "ruby-lang.org", constraint})
        await read_YAML_FM(path)
        break
      case ".yarnrc":
        pkgs.push({ project: "classic.yarnpkg.com", constraint })
        await read_YAML_FM(path)
        break
      case "yarn.lock":
        pkgs.push({ project: "yarnpkg.com", constraint })
        break
      case ".yarnrc.yml":
        pkgs.push({ project: "yarnpkg.com", constraint })
        await read_YAML_FM(path)
        break
      case "bun.lockb":
        pkgs.push({ project: "bun.sh", constraint: new semver.Range(">=1") })
        break
      case "pnpm-lock.yaml":
        pkgs.push({ project: "pnpm.io", constraint })
        break
      case "pixi.toml":
        pkgs.push({ project: 'prefix.dev', constraint })
        await read_YAML_FM(path)
        break
      case "pkgx.yml":
      case "pkgx.yaml":
      case ".pkgx.yml":
      case ".pkgx.yaml":
        await parse_well_formatted_node(await path.readYAML())
        break
      }
    } else if (isDirectory) {
      switch (name) {
      case ".git":
        pkgs.push({project: "git-scm.org", constraint})
        break
      case ".hg":
        pkgs.push({project: "mercurial-scm.org", constraint})
        break
      case ".svn":
        pkgs.push({project: "apache.org/subversion", constraint})
        break
      }
    }
  }

  if (has_package_json && !pkgs.some(pkg => pkg.project === 'bun.sh') && !pkgs.some(pkg => pkg.project === 'nodejs.org')) {
    pkgs.push({project: "nodejs.org", constraint})
  }

  return { pkgs, env }

  //---------------------------------------------- parsers
  async function deno(path: Path) {
    pkgs.push({project: "deno.land", constraint})
    const json = JSONC.parse(await path.read())
    // deno-lint-ignore no-explicit-any
    if (isPlainObject(json) && (json as any).pkgx) {
      // deno-lint-ignore no-explicit-any
      let node = (json as any).pkgx
      if (isString(node) || isArray(node)) node = { dependencies: node }
      await parse_well_formatted_node(node)
    }
  }

  async function version_file(path: Path, project: string) {
    let s = (await path.read()).trim()
    if (s.startsWith('v')) s = s.slice(1)  // v prefix has no effect but is allowed
    s = `${project}@${s}`
    pkgs.push(utils.pkg.parse(s))
  }

  async function python_version(path: Path) {
    const s = (await path.read()).trim()
    const lines = s.split("\n")
    for (let l of lines) {
      l = l.trim()
      if (!l) continue  // skip empty lines
      if (l.startsWith('#')) continue  // skip commented lines
      // TODO: How to handle 'system'?
      // TODO: How to handle non-bare versions like pypy3.9-7.3.11, stackless-3.7.5, etc. in pyenv install --list?
      l = `python.org@${l}`
      try {
        pkgs.push(utils.pkg.parse(l))
        break // only one thanks
      } catch {
        //noop pyenv sticks random shit in here
      }
    }
  }

  async function terraform_version(path: Path) {
    const terraform_version = (await path.read()).trim()
    const package_descriptor = `terraform.io@${terraform_version}`
    pkgs.push(utils.pkg.parse(package_descriptor))
  }

  async function package_json(path: Path) {
    const json = JSON.parse(await path.read());
    let node = json?.pkgx;
    if (isString(node) || isArray(node)) node = { dependencies: node }
    if (!node && json?.engines) {
      node = {
        dependencies: {
          ...(json.engines.node && { 'nodejs.org': json.engines.node }),
          ...(json.engines.npm && { 'npmjs.com': json.engines.npm }),
        },
      };
    }
    await parse_well_formatted_node(node)
    has_package_json = true
  }

  async function skaffold_yaml(path: Path){
    const yaml = await path.readYAML()
    if (!isPlainObject(yaml)) return
    if (yaml.build?.local?.useDockerCLI?.toString() === true || yaml.deploy?.docker){
      pkgs.push({
        project: "docker.com/cli",
        constraint: new semver.Range(`*`)
      })
    }
    if (yaml.deploy?.kubectl){
      pkgs.push({
        project: "kubernetes.io/kubectl",
        constraint: new semver.Range(`*`)
      })
    }
    if (yaml.deploy?.kubeContext?.match("minikube")){
      pkgs.push({
        project: "kubernetes.io/minikube",
        constraint: new semver.Range(`*`)
      })
    }
    if (yaml.deploy?.helm || yaml.manifests?.helm){
      pkgs.push({
        project: "helm.sh",
        constraint: new semver.Range(`*`)
      })
    }
    if (yaml.deploy?.kpt || yaml.manifests?.kpt){
      pkgs.push({
        project: "kpt.dev",
        constraint: new semver.Range(`*`)
      })
    }
    if (yaml.manifests?.kustomize){
      pkgs.push({
        project: "kubernetes.io/kustomize",
        constraint: new semver.Range(`*`)
      })
    }
  }

  async function github_actions(path: Path) {
    const yaml = await path.readYAML()
    if (!isPlainObject(yaml)) return
    const rv = yaml.runs?.using?.match(/node(\d+)/)
    if (rv?.[1]) {
      pkgs.push({
        project: "nodejs.org",
        constraint: new semver.Range(`^${rv?.[1]}`)
      })
    }
    await parse_well_formatted_node(yaml.pkgx)
  }

  async function pyproject(path: Path) {
    //TODO parse the TOML lol!

    const content = await path.read()
    if (content.includes("poetry.core.masonry.api")) {
      pkgs.push({project: "python-poetry.org", constraint})
    } else {
      //TODO other pkging systems…?
      pkgs.push({project: "pip.pypa.io", constraint})
    }
    await read_YAML_FM(path)
  }

  //---------------------------------------------- YAML FM utils

  async function read_YAML_FM(path: Path) {
    //TODO be smart with knowing the comment types
    // this parsing logic should be in the pantry ofc

    //TODO should only parse blank lines and comments before bailing
    // at the first non-comment line

    //TODO should be savvy to what comment type is acceptable!

    let yaml: string | undefined
    const fd = await Deno.open(path.string, { read: true })
    try {
      for await (const line of readLines(fd)) {
        if (yaml !== undefined) {
          if (/^((#|\/\/)\s*)?---(\s*\*\/)?$/.test(line.trim())) {
            let node = parseYaml(yaml)
            /// using a `pkgx` node is safer (YAML-FM is a free-for-all) but is not required
            if (isPlainObject(node) && node.pkgx) {
              node = isString(node.pkgx) || isArray(node.pkgx) ? { dependencies: node.pkgx } : node.pkgx
            }
            return await parse_well_formatted_node(node)
          }
          yaml += line?.replace(/^(#|\/\/)/, '')
          yaml += "\n"
        } else if (/^((\/\*|#|\/\/)\s*)?---/.test(line.trim())) {
          yaml = ''
        }
      }
    } finally {
      fd.close()
    }
  }

  async function parse_well_formatted_node(obj: unknown) {
    if (!isPlainObject(obj)) {
      return   //TODO diagnostics in verbose mode, error if `pkgx` node
    }

    const yaml = await extract_well_formatted_entries(obj)

    for (let [k, v] of Object.entries(yaml.env)) {
      if (isNumber(v)) v = v.toString()
      if (isString(v)) {
        //TODO provide diagnostics if verbose, throw if part of a `pkgx` node
        env[k] = fix(v)
      }
    }

    pkgs.push(...yaml.deps)

    function fix(input: string): string {
      const moustaches = useMoustaches()

      //TODO deprecate moustaches and instead use env vars

      const foo = [
        ...moustaches.tokenize.host(),
        { from: "home", to: Path.home().string },  //TODO deprecate and use $HOME once pantry is migrated
        { from: "srcroot", to: dir.string }  //TODO deprecate and use $PWD once pantry is migrated
      ]

      return moustaches.apply(input, foo)
    }
  }
}

/// YAML-FM must be explicitly marked with a `dependencies` node
async function extract_well_formatted_entries(yaml: PlainObject): Promise<{ deps: PackageRequirement[], env: Record<string, unknown> }> {
  const deps = await parse_deps(yaml.dependencies)
  const env = isPlainObject(yaml.env) ? yaml.env : {}  //TODO provide diagnostics if verbose, throw if part of a `pkgx` node
  return { deps, env }
}

async function parse_deps(node: unknown) {
  if (isString(node)) node = node.split(/\s+/).filter(x => x)

  function parse(input: string) {
    // @latest means '*' here, we refuse to always check for newer versions
    // that is up to the user to initiate, however we should allow the spec since
    // users expect it. Maybe we should console.warn?
    // discussion: https://github.com/pkgxdev/pkgx/issues/797
    if (input.endsWith('@latest')) input = input.slice(0, -6)

    return utils.pkg.parse(input)
  }

  if (isArray(node)) node = node.map(parse).reduce((acc, curr) => {
    acc[curr.project] = curr.constraint.toString()
    return acc
  }, {} as Record<string, string>)

  if (!isPlainObject(node)) {
    return [] //TODO provide diagnostics if verbose, throw if part of a `pkgx` node
  }

  const pkgs = Object.entries(node)
      .compact(([project, constraint]) => {
        // see comment above in parse() about @latest
        if (/^@?latest$/.test(constraint)) constraint = '*'
        return validatePackageRequirement(project, constraint)
      })
      .map(utils.pkg.str)  //FIXME lol inefficient
      .map(x => _internals.find(x))

  return await Promise.all(pkgs)
}

export const _internals = {
  find: parse_pkg_str
}
