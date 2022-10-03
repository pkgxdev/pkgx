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

export async function usePackageYAMLFrontMatter(script: Path, srcroot?: Path): Promise<Return2> {
  const yaml = await readYAMLFrontMatter(script)
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
  return {...rv, getArgs }

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

async function readYAMLFrontMatter(path: Path): Promise<unknown> {
  //TODO reading whole file is inefficient, read in chunks until we find the end of the front matter

  //TODO be smart with knowing the comment types
  // this parsing logic should be in the pantry ofc

  const txt = await path.read()
  const lines = txt.split("\n")
  let line = lines.shift()
  while (line !== undefined) {
    line = lines.shift()
    if (line?.trim().match(/^((\/\*|#|\/\/)\s*)?---/)) break
  }
  if (lines.length == 0) throw "no-front-matter"
  let yaml = ''
  while (line !== undefined) {
    line = lines.shift()
    if (line?.trim().match(/^((#|\/\/)\s*)?---(\s*\*\/)?$/)) break
    yaml += line?.replace(/^#\s*/, '')
    yaml += "\n"
  }
  return await parseYaml(yaml)
}
