import { PackageRequirement } from "types"
import { PlainObject } from "is_what"
import { host, validate_str } from "utils"
import { isString, isNumber } from "is_what"
import Path from "path"
import * as semver from "semver"

export function validatePackageRequirement(input: PlainObject): PackageRequirement | undefined {
  let { constraint, project } = input

  if (host().platform == 'darwin' && project == "apple.com/xcode/clt") {
    if (Deno.env.get("GITHUB_ACTIONS")) {
      // noop
      // GHA has clt installed, just differently
    } else if (!Path.root.join('Library/Developer/CommandLineTools/usr/bin/clang').isFile()) {
      throw new Error("run: xcode-select --install")
    }
    //TODO strictly if Xcode is installed, that’s enough
    return  // compact this dep away
  }

  validate_str(project)

  //HACKS
  if (constraint == 'c99' && project == 'tea.xyz/gx/cc') {
    constraint = '1.0.0'
  }

  if (constraint === undefined) {
    constraint = '*'
  } else if (isNumber(constraint)) {
    constraint = `${constraint}`
  }
  if (!isString(constraint)) {
    throw new Error(`invalid constraint: ${constraint}`)
  }

  constraint = new semver.Range(constraint)

  return {
    project,
    constraint
  }
}
