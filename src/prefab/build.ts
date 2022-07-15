import { Path, Package, PackageRequirement, semver } from "types"
import usePantry from "hooks/usePantry.ts"
import useCellar from "hooks/useCellar.ts"
import useShellEnv from "hooks/useShellEnv.ts"
import { run, undent } from "utils"
import usePlatform from "hooks/usePlatform.ts";

interface Options {
  pkg: Package
  deps: {
    build: PackageRequirement[]
    runtime: PackageRequirement[]
  }
}

export default async function build({ pkg, deps }: Options): Promise<Path> {
  const pantry = usePantry()
  const dst = useCellar().mkpath(pkg)
  const src = dst.join("src")
  const env = await useShellEnv([...deps.build, ...deps.runtime])
  const sh = await pantry.getBuildScript(pkg)
  const { platform } = usePlatform()

  if (env.pending.length) {
    throw {uninstalled: env.pending}
  }

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
  await fix(dst, [
    ...deps.runtime,
    {project: pkg.project, constraint: new semver.Range(`=${pkg.version}`)}
  ] )

  return dst
}

function expand(env: Record<string, string[]>) {
  let rv = ''
  for (let [key, value] of Object.entries(env)) {
    if (key == 'PATH') value = value.concat("/usr/bin:/bin:/usr/sbin:/sbin") //FIXME
    rv += `export ${key}='${value.join(":")}'\n`
  }
  return rv
}

async function* exefiles(prefix: Path) {
  for (const basename of ["bin", "lib"]) { //TODO the rest
    const d = prefix.join(basename).isDirectory()
    if (!d) continue
    for await (const [exename] of d.ls()) {
      if (exename.isExecutableFile()) yield exename
    }
  }
}

/// fix rpaths or install names for executables and dynamic libraries
async function fix(prefix: Path, pkgs: PackageRequirement[]) {
  if (usePlatform().platform != 'linux') return
  // ^^ TODO we need to do this on mac too

  for await (const exename of exefiles(prefix)) {
    await setRpath(exename, pkgs)
  }
}

//TODO this is not resilient to upgrades (obv)
async function setRpath(exename: Path, pkgs: PackageRequirement[]) {
  const cellar = useCellar()
  const rpath = (await Promise.all(pkgs.map(pkg => prefix(pkg)))).join(":")

  try {
    await run({
      cmd: ["patchelf", "--set-rpath", rpath, exename]
    })
  } catch (e) {
    console.warn(e)
    //FIXME we skip all errors as we are not checking if files are executables rather than eg. scripts
  }

  async function prefix(pkg: PackageRequirement) {
    return (await cellar.resolve(pkg)).path.join("lib").string
  }
}
