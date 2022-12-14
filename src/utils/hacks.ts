import { PackageRequirement } from "types"
import { PlainObject } from "is_what"
import { host, validate_str } from "utils"
import { isString, isNumber } from "is_what"
import * as semver from "semver"

export function validatePackageRequirement(input: PlainObject): PackageRequirement | undefined {
  let { constraint, project } = input

  if (host().platform == 'darwin' && (project == "apple.com/xcode/clt" || project == "tea.xyz/gx/make")) {
    // Apple will error out and prompt the user to install
    //NOTE what we would really like is to error out when this dependency is *used*
    // this is not the right place to error that. so FIXME
    return  // compact this dep away
  }
  if (host().platform == 'linux' && project == "tea.xyz/gx/make") {
    project = "gnu.org/make"
    constraint = '*'
  }

  validate_str(project)

  //HACKS
  if (constraint == 'c99' && project == 'tea.xyz/gx/cc') {
    constraint = '^0.1'
  }

  if (constraint === undefined) {
    constraint = '*'
  } else if (isNumber(constraint)) {
    constraint = `^${constraint}`
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
