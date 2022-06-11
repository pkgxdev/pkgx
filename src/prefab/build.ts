import { Path, Package, PackageRequirement } from "types"
import usePantry from "hooks/usePantry.ts"
import useCellar from "hooks/useCellar.ts"
import useShellEnv from "hooks/useShellEnv.ts"
import { run, undent } from "utils"
import usePlatform from "hooks/usePlatform.ts";

interface Options {
  pkg: Package
  deps: PackageRequirement[]
}

export default async function build({ pkg, deps }: Options): Promise<Path> {
  const pantry = usePantry()
  const dst = useCellar().mkpath(pkg)
  const src = dst.join("src")
  const env = await useShellEnv(deps)
  const sh = await pantry.getBuildScript(pkg)
  const platform = usePlatform()

  const cmd = dst.join("build.sh").write({ force: true, text: undent`
    #!/bin/sh

    set -e
    set -o pipefail
    cd "${src}"

    export CFLAGS="-target ${platform.target} $CFLAGS"
    export CCFLAGS="-target ${platform.target} $CCFLAGS"
    export CXXFLAGS="-target ${platform.target} $CXXFLAGS"
    export LDFLAGS="-target ${platform.target} $LDFLAGS"

    ${expand(env.vars)}

    ${sh}
    `
  }).chmod(0o500)

  await run({ cmd })

  return dst
}

function expand(env: Record<string, string[]>) {
  let rv = ''
  for (let [key, value] of Object.entries(env)) {
    if (key == 'PATH') value = value.concat("/usr/bin:/bin:/usr/sbin:/sbin") //FIXME
    rv += `export ${key}="${value.join(":")}"\n`
  }
  return rv
}
