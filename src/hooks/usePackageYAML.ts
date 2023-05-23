import { isPlainObject, isString, isArray, PlainObject } from "is-what"
import { PackageRequirement, Path, hacks, utils, hooks } from "tea"
const { validatePackageRequirement } = hacks
const { useMoustaches, useConfig } = hooks
const { validate } = utils

interface Return1 {
  getDeps: (wbuild: boolean) => PackageRequirement[]
  yaml: PlainObject
}

export default function usePackageYAML(yaml: unknown): Return1 {
  //TODO do magic: if (err == "no-front-matter")

  if (!isPlainObject(yaml)) throw new Error("bad-yaml")

  const getDeps = (wbuild: boolean) => {
    return [...go(yaml.dependencies), ...go(wbuild && yaml.build?.dependencies)]
    // deno-lint-ignore no-explicit-any
    function go(node: any) {
      if (!node) return []
      return Object.entries(validate.obj(node))
        .compact(([project, constraint]) =>
          validatePackageRequirement(project, constraint))
    }
  }

  return { getDeps, yaml }
}

export interface FrontMatter {
  args: string[]
  pkgs: PackageRequirement[]
  env: Record<string, string>
}

export function refineFrontMatter(obj: unknown, srcroot?: Path): FrontMatter {
  const rv = usePackageYAML(obj)

  const getArgs = () => {
    const fn1 = () => {
      if (rv.yaml.args === undefined) return []
      if (isString(rv.yaml.args)) return rv.yaml.args.split(/\s+/)
      if (isArray(rv.yaml.args)) return rv.yaml.args.map(x => `${x}`)
      throw new Error("bad-yaml")
    }
    return fn1().map(fix)
  }

  const env: Record<string, string> = {}
  if (isPlainObject(rv.yaml.env)) {
    for (const [k, v] of Object.entries(rv.yaml.env)) {
      if (!isString(v)) throw new Error()
      env[k] = fix(v)
    }
  }

  return {
    pkgs: rv.getDeps(false),
    args: getArgs(),
    env
  }

  function fix(input: string): string {
    const moustaches = useMoustaches()

    const foo = [
      ...moustaches.tokenize.host(),
      { from: "tea.prefix", to: useConfig().prefix.string },
      { from: "home", to: Path.home().string }
    ]

    if (srcroot) {
      foo.push({ from: "srcroot", to: srcroot!.string})
    }

    return moustaches.apply(input, foo)
  }
}

export async function usePackageYAMLFrontMatter(script: Path, srcroot?: Path): Promise<FrontMatter | undefined> {
  const yaml = await readYAMLFrontMatter(script)
  if (!yaml) return
  return refineFrontMatter(yaml, srcroot)
}


import { parse as parseYaml } from "https://deno.land/std@0.182.0/encoding/yaml.ts"
import { readLines } from "deno/io/read_lines.ts"

async function readYAMLFrontMatter(path: Path): Promise<PlainObject | undefined> {
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
          const rv = await parseYaml(yaml)
          if (!isPlainObject(rv)) throw new Error("yaml is not dictionary")
          return rv
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
