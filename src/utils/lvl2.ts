// lvl2 utilities can use hooks etc.

import usePlatform from "hooks/usePlatform.ts"
import { PackageRequirement, PlainObject, Path, semver } from "types"
import { isString } from "utils"

export function validatePackageRequirement(input: PlainObject): PackageRequirement | undefined {
  let { constraint: rawconstraint, project } = input
  const isMac = usePlatform().platform == 'darwin'

  if (!isString(rawconstraint) && !isString(project))

  console.debug({project, constraint: rawconstraint})

  //<FIXME>
  if (project == "tea.xyz/gx/cc" || project == "tea.xyz/gx/c++") {
    if (isMac && hasCLT()) return  //FIXME this should not be here, in pantry obv.
    project = "llvm.org"
    rawconstraint = "*"
  }
  if (project == "tea.xyz/gx/make") {
    if (isMac && hasCLT()) return  //FIXME as above
    project = "gnu.org/make"
    rawconstraint = "*"
  }
  if (project == "tea.xyz") return
  //</FIXME>

  const constraint = new semver.Range(`${rawconstraint}`)

  console.debug({project, constraint})

  return { project, constraint }

  function hasCLT() {
    return !!Path.root.join('Library/Developer/CommandLineTools/usr/bin/clang').isFile()
  }
}
