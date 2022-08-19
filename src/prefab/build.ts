import { Path, Package, PackageRequirement, semver } from "types"
import usePantry from "hooks/usePantry.ts"
import useCellar from "hooks/useCellar.ts"
import useShellEnv, { expand } from "hooks/useShellEnv.ts"
import { run, runAndGetOutput, undent } from "utils"
import usePlatform from "hooks/usePlatform.ts"
import hydrate from "prefab/hydrate.ts"

interface Options {
  pkg: Package
  prebuild: () => Promise<void>
  deps: {
    build: PackageRequirement[]
    runtime: PackageRequirement[]
  }
}

export default async function build({ pkg, deps, prebuild }: Options): Promise<Path> {
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

  /// FIXME: no one likes this. `set -o pipefail` is the reason for this requirement.
  const shell = platform === "linux" ? "bash" : "sh"

  const cmd = dst.join("build.sh").write({ force: true, text: undent`
    #!/bin/${shell}

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

  await fix(dst, [
    ...wet,
    {project: pkg.project, constraint: new semver.Range(`=${pkg.version}`)}
  ])

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

async function* exefiles(prefix: Path) {
  for (const basename of ["bin", "lib"]) { //TODO the rest
    const d = prefix.join(basename).isDirectory()
    if (!d) continue
    for await (const [exename] of d.ls()) {
      //TODO not good enough since sofiles often do not have x set
      // if (exename.isExecutableFile()) yield exename
      yield exename
    }
  }
}

/// fix rpaths or install names for executables and dynamic libraries
async function fix(prefix: Path, pkgs: PackageRequirement[]) {
  for await (const exename of exefiles(prefix)) {
    await set_rpaths(exename, pkgs)
  }
}

//TODO this is not resilient to upgrades (obv)
//NOTE solution is to have the rpath reference major version (or more specific if poss)
//  and then have virtual env manager be more specific via (DY)?LD_LIBRARY_PATH
async function set_rpaths(exename: Path, pkgs: PackageRequirement[]) {
  const cellar = useCellar()
  const our_rpaths = await Promise.all(pkgs.map(pkg => prefix(pkg)))

  const cmd = await (async () => {
    switch (usePlatform().platform) {
    case 'linux': {
      //FIXME we need this for perl
      // however really we should just have an escape hatch *just* for stuff that sets its own rpaths
      const their_rpaths = (await runAndGetOutput({
        cmd: ["patchelf", "--print-rpath", exename],
      })).split("\n")

      const rpaths =[...their_rpaths, ...our_rpaths].join(':')

      //FIXME use runtime-path since then LD_LIBRARY_PATH takes precedence which our virtual env manager requires
      return ["patchelf", "--force-rpath", "--set-rpath", rpaths, exename]
    }
    case 'darwin':
      //FIXME we need to set DYLD_LIBRARY_PATH for virtual envs to work on macOS
      //FIXME we need to remove any rpaths set by the build tool
      //FIXME we need to undo any install-name paths and instead set them with rpath
      //FIXME set a sensible id for enduser
      return [
        "install_name_tool",
        ...our_rpaths.flatMap(rpath => ["-add_rpath", rpath]),
        exename
      ]
    case 'windows':
      throw new Error()
    }
  })()

  try {
    await run({ cmd })
  } catch (e) {
    //FIXME check the file magic bits to see if we can actually rpath these files lol
    console.warn(e)
  }

  async function prefix(pkg: PackageRequirement) {
    return (await cellar.resolve(pkg)).path.join("lib").string
  }
}
