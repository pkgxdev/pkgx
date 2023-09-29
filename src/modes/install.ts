import { PackageRequirement, Path, hooks, utils } from "tea"
import undent from 'outdent'
const { usePantry } = hooks

export default async function(pkgs: PackageRequirement[]) {
  const usrlocal = new Path("/usr/local/bin")
  let n = 0

  try {
    await write(usrlocal, pkgs)
  } catch {
    //TODO isWritable check
    await write(Path.home().join(".local/bin"), pkgs)
  }

  if (n == 0) {
    console.error('tea: no programs provided by pkgs')
  }

  async function write(dst: Path, pkgs: PackageRequirement[]) {
    for (const pkg of pkgs) {
      for (const program of await usePantry().project(pkg).provides()) {
        const f = dst.mkdir('p').join(program)
        f.write({ text: undent`
          #!/bin/sh
          exec tea +${utils.pkg.str(pkg)} -- ${program} "$@"
          `}).chmod(0o755)
        console.error('tea: installed:', f)
        n++
      }
    }
  }
}
