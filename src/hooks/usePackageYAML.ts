import { PackageRequirement, PlainObject, Path } from "types"
import { isPlainObject, isString, isArray, validatePlainObject } from "utils"
import { validatePackageRequirement } from "utils/lvl2.ts"

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
      return Object.entries(validatePlainObject(node))
        .compactMap(([project, constraint]) => validatePackageRequirement({ project, constraint }))
    }
  }

  return { getDeps, yaml }
}

interface Return2 extends Return1 {
  getArgs: () => string[]
}

export async function usePackageYAMLFrontMatter(script: Path, srcroot?: Path): Promise<Return2> {
  const yaml = await script.readYAMLFrontMatter()
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
    return input
      .replace(/{{\s*srcroot\s*}}/ig, srcroot!.string)
      .replace(/{{\s*home\s*}}/ig, Path.home().string)
  }
}
