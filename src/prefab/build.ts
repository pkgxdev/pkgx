import { Path, Package, PackageRequirement, semver } from "types"
import usePantry from "hooks/usePantry.ts"
import useCellar from "hooks/useCellar.ts"
import useShellEnv, { expand } from "hooks/useShellEnv.ts"
import { run, undent } from "utils"
import fix_pkg_config_files from "prefab/fix-pkg-config-files.ts"
import fix_rpaths from "./fix-rpaths.ts";

interface Options {
  pkg: Package
  prebuild: () => Promise<void>
  deps: {
    // only include direct build-time dependencies
    build: PackageRequirement[]

    // include transitive dependencies
    runtime: PackageRequirement[]
  }
  /// additional env to set, will override (REPLACE) any calculated env
  env?: Record<string, string[]>
}

export default async function build({ pkg, deps, prebuild, env: add_env }: Options): Promise<Path> {
  const pantry = usePantry()
  const cellar = useCellar()
  const dst = cellar.mkpath(pkg)
  const src = dst.join("src")
  const env = await useShellEnv([...deps.runtime, ...deps.build])
  const sh = await pantry.getScript(pkg, 'build')

  if (cellar.prefix.string != "/opt") {
    console.error({ TEA_PREFIX: cellar.prefix.string })
    throw new Error("builds go to /opt (try TEA_PREFIX=/opt)")
  }

  if (env.pending.length) {
    console.error({uninstalled: env.pending})
    throw new Error("uninstalled")
  }

  await prebuild()

  if (add_env) {
    for (const [key, value] of Object.entries(add_env)) {
      env.vars[key] = value
    }
  }

  const cmd = dst.join("build.sh").write({ force: true, text: undent`
    #!/bin/bash

    set -e
    set -o pipefail
    set -x
    cd "${src}"

    ${expand(env.vars)}

    ${/*FIXME hardcoded paths*/ ''}
    export PATH=/opt/tea.xyz/var/pantry/scripts/brewkit:"$PATH"
    export PATH='/opt/tea.xyz/v*/bin':"$PATH"

    ${sh}
    `
  }).chmod(0o500)

  await run({ cmd })

  const installation = { pkg, path: dst }
  const self = {project: pkg.project, constraint: new semver.Range(`=${pkg.version}`)}

  await fix_rpaths(installation, [...deps.runtime, self])
  await fix_pkg_config_files({ path: dst, pkg })

  return dst
}
