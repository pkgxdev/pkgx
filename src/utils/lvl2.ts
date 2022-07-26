// lvl2 utilities can use hooks etc.

import usePlatform from "hooks/usePlatform.ts"
import { PackageRequirement, PlainObject, Path, semver } from "types"

export function validatePackageRequirement(input: PlainObject): PackageRequirement | undefined {
  let { constraint: rawconstraint, project } = input
  const isMac = usePlatform().platform == 'darwin'

  console.debug({project, constraint: rawconstraint})

  //<FIXME>
  if (project == "tea.xyz/gx/cc" || project == "tea.xyz/gx/c++") {
    if (detect()) return  //FIXME this should not be here, in pantry obv.
    project = "llvm.org"
    rawconstraint = "*"
  }
  if (project == "tea.xyz/gx/make") {
    if (detect()) return  //FIXME as above
    project = "gnu.org/make"
    rawconstraint = "*"
  }
  if (project == "tea.xyz") return
  //</FIXME>

  const constraint = new semver.Range(`${rawconstraint}`)

  console.debug({project, constraint})

  return { project, constraint }

  function detect() {
    //FIXME HACKS GALORE
    // we will fix properly with `detect.ts` and bootstrapping support
    // most of this is so we can bootstrap the tea bottles even though things like make require make to build themselves
    if (isMac && Path.root.join('Library/Developer/CommandLineTools/usr/bin/clang').isFile()) {
      return true
    } else if (isMac && Deno.env.get("GITHUB_ACTIONS")) {
      return true
    } else {
      return false
    }
  }
}
