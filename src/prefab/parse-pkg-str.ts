import { ProvidesError, AmbiguityError } from "../utils/error.ts"
import { utils, hooks, PackageRequirement } from "pkgx"
import failsafe from "./failsafe.ts"

export default async function(input: string, opts?: { latest: 'ok' }): Promise<PackageRequirement & { update?: boolean }> {
  const { find } = _internals

  let update = false

  if (opts?.latest && input.endsWith("@latest")) {
    input = input.slice(0, -7)
    update = true
  }

  const rawpkg = utils.pkg.parse(input)

  const projects = await failsafe(() => find(rawpkg.project))
  if (projects.length <= 0) throw new ProvidesError(input)
  if (projects.length > 1) throw new AmbiguityError(input, projects)

  const project = projects[0].project //FIXME libpkgx forgets to correctly assign type
  const constraint = rawpkg.constraint

  return { project, constraint, update }
}

export const _internals = {
  find: hooks.usePantry().find
}
