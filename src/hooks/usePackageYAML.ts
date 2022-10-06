import { PackageRequirement } from "types"
import { isPlainObject, isString, isArray, PlainObject } from "is_what"
import { validatePackageRequirement } from "utils/hacks.ts"
import { usePrefix } from "hooks"
import { validate_plain_obj } from "utils"
import Path from "path"
import useMoustaches from "./useMoustaches.ts";

interface Return1 {
  getDeps: (wbuild: boolean) => PackageRequirement[]
  yaml: PlainObject
}

export default function usePackageYAML(yaml: unknown): Return1 {
  //TODO do magic: if (err == "no-front-matter")

  if (!isPlainObject(yaml)) throw "bad-yaml"

  const getDeps = (wbuild: boolean) => {
    return [...go(yaml.dependencies), ...go(wbuild && yaml.build?.dependencies)]
    // deno-lint-ignore no-explicit-any
    function go(node: any) {
      if (!node) return []
      return Object.entries(validate_plain_obj(node))
        .compact(([project, constraint]) => validatePackageRequirement({ project, constraint }))
    }
  }

  return { getDeps, yaml }
}

interface Return2 extends Return1 {
  getArgs: () => string[]
}

interface FrontMatter {
  args: string[]
  pkgs: PackageRequirement[]
}

export async function usePackageYAMLFrontMatter(script: Path, srcroot?: Path): Promise<FrontMatter | undefined> {
  const yaml = await readYAMLFrontMatter(script)
  if (!yaml) return
  const rv = usePackageYAML(yaml)

  const getArgs = () => {
    const fn1 = () => {
      if (rv.yaml.args === undefined) return []
      if (isString(rv.yaml.args)) return rv.yaml.args.split(/\s+/)
      if (isArray(rv.yaml.args)) return rv.yaml.args.map(x => `${x}`)
      throw "bad-yaml"
    }
    if (srcroot) {
      //TODO if no srcroot and args contain {{srcroot}} show warning
      return fn1().map(fix)
    } else {
      return fn1()
    }
  }

  return {
    pkgs: rv.getDeps(false),
    args: getArgs()
  }

  function fix(input: string): string {
    const moustaches = useMoustaches()

    return moustaches.apply(input, [
      ...moustaches.tokenize.host(),
      { from: "tea.prefix", to: usePrefix().string },
      { from: "srcroot", to: srcroot!.string},
      { from: "home", to: Path.home().string }
    ])
  }
}


import { parse as parseYaml } from "deno/encoding/yaml.ts"

async function readYAMLFrontMatter(path: Path): Promise<PlainObject | undefined> {
  //TODO be smart with knowing the comment types
  // this parsing logic should be in the pantry ofc

  let yaml: string | undefined
  for await (const line of path.readLines()) {
    if (yaml !== undefined) {
      if (line.trim().match(/^((#|\/\/)\s*)?---(\s*\*\/)?$/)) {
        const rv = await parseYaml(yaml)
        if (!isPlainObject(rv)) throw new Error("bad-yaml")
        return rv
      }
      yaml += line?.replace(/^#\s*/, '')
      yaml += "\n"
    } else if (line.trim().match(/^((\/\*|#|\/\/)\s*)?---/)) {
      yaml = ''
    }
  }
}
