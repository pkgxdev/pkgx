import { plumbing, hooks, semver, PackageRequirement } from "pkgx"
import { AmbiguityError } from "../utils/error.ts"
const { useCellar } = hooks
const { which } = plumbing

export default async function(arg0: string, dry: PackageRequirement[]): Promise<{ project: string, constraint: semver.Range, shebang: string[] } | undefined> {
  const { has, which } = _internals

  let pkgs = await which(arg0, { providers: true, all: true })
  if (pkgs.length > 1) {
    // there are multiple results for this “provides”
    // if the user specified one of them then use it
    const set = new Set(dry.map(pkg => pkg.project))
    const powder = pkgs.filter(x => set.has(x.project))
    if (powder.length == 1) {
      return powder[0]
    } else if (powder.length > 1) {
      throw new AmbiguityError(arg0, powder)
    }

    // if only one of them is installed then pick that
    // ∵ the user already made a choice
    const installs = (await Promise.all(pkgs.map(has))).compact()
    if (installs.length !== 1) {
      throw new AmbiguityError(arg0, pkgs)
    } else for (const pkg of pkgs) {
      if (installs[0]!.pkg.project == pkg.project) {
        pkgs = [pkg]
        break
    }}
  }
  return pkgs[0]
}

export const _internals = {
  which,
  has: useCellar().has
}
