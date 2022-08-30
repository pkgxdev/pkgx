import { Path, Package, PackageRequirement, semver } from "types"
import usePantry from "hooks/usePantry.ts"
import useCellar from "hooks/useCellar.ts"
import useShellEnv, { expand } from "hooks/useShellEnv.ts"
import { run, undent } from "utils"
import usePlatform from "hooks/usePlatform.ts"
import hydrate from "prefab/hydrate.ts"
import fix_pkg_config_files from "prefab/fix-pkg-config-files.ts"
import fix_rpaths from "./fix-rpaths.ts";

interface Options {
  pkg: Package
  prebuild: () => Promise<void>
  deps: {
    build: PackageRequirement[]
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
  const runtime_deps = await filterAndHydrate(deps.runtime)
  const env = await useShellEnv([...deps.build, ...runtime_deps])
  const sh = await pantry.getScript(pkg, 'build')
  const { platform } = usePlatform()

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

    ${sh}
    `
  }).chmod(0o500)

  await run({ cmd })

  // the fix step requires the transitive runtime deps also
  // because we need to set rpaths for everything all the way down
  const wet = await hydrate(deps.runtime)

  const installation = { pkg, path: dst }

  await fix_rpaths(installation, [
    ...wet,
    {project: pkg.project, constraint: new semver.Range(`=${pkg.version}`)}
  ])

  await fix_pkg_config_files({ path: dst, pkg })

  return dst
}

//TODO only supplement PKG_CONFIG_PATH for now
async function filterAndHydrate(pkgs: PackageRequirement[]): Promise<PackageRequirement[]> {
  const set = new Set(pkgs.map(({project}) => project))
  const cellar = useCellar()
  const a = await hydrate(pkgs)
  const b = await Promise.all(a.map(hasPkgConfig))
  return b.compactMap(x => x)

  async function hasPkgConfig(pkg: PackageRequirement) {
    // we don’t want to remove explicit deps!
    if (set.has(pkg.project)) return pkg

    // if a transitive dep then let's see if we need to add its env
    //TODO should only add specific things eg. PATH or PKG_CONFIG_PATH
    // rationale: libs should know how to link their deps or the build system needs to do it itself
    //   if we add those LIBRARY_PATHs we're asking for unexpected shit to happen
    const a = await cellar.resolve(pkg)
    if (a.path.join("lib/pkgconfig").isDirectory()) return pkg
    if (a.path.join("lib").isDirectory()) return pkg
    if (a.path.join("include").isDirectory()) return pkg
    if (a.path.join("bin").isDirectory()) return pkg
  }
}
