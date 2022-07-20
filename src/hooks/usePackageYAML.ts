import { PackageRequirement, PlainObject, semver, Path } from "types"
import { isPlainObject, isString, isArray } from "utils"
import usePlatform from "hooks/usePlatform.ts"

interface Return1 {
  getDeps: (wbuild: boolean) => PackageRequirement[]
  yaml: PlainObject
}

export default function usePackageYAML(yaml: unknown): Return1 {
  //TODO do magic: if (err == "no-front-matter")

  if (!isPlainObject(yaml)) throw "bad-yaml"

  const getDeps = (wbuild: boolean) => {
    const isMac = usePlatform().platform == 'darwin'

    return [...go(yaml.dependencies), ...go(wbuild && yaml.build?.dependencies)]
    // deno-lint-ignore no-explicit-any
    function go(node: any) {
      if (!node) return []
      const rv: PackageRequirement[] = []
      const deps = validatePlainObject(node)
      for (let [project, rawconstraint] of Object.entries(deps)) {

        console.debug({project, constraint: rawconstraint})

        //<FIXME>
        if (project == "tea.xyz/gx/cc" || project == "tea.xyz/gx/c++") {
          if (isMac && hasCLT()) continue  //FIXME this should not be here, in pantry obv.
          project = "llvm.org"
          rawconstraint = "*"
        }
        if (project == "tea.xyz/gx/make") {
          if (isMac && hasCLT()) continue  //FIXME as above
          project = "gnu.org/make"
          rawconstraint = "*"
        }
        if (project == "tea.xyz") continue
        //</FIXME>

        const constraint = new semver.Range(`${rawconstraint}`)

        console.debug({project, constraint})

        rv.push({ project, constraint })
      }
      return rv

      function hasCLT() {
        return !!Path.root.join('Library/Developer/CommandLineTools/bin/clang').isFile()
      }
    }
  }

  return { getDeps, yaml }
}

// deno-lint-ignore no-explicit-any
function validatePlainObject(input: any): PlainObject {
  if (!isPlainObject(input)) throw "not-plain-obj"
  return input
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
