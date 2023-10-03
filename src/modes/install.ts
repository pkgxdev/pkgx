import { PackageRequirement, Path, PkgxError, hooks, utils } from "pkgx"
import { is_shebang } from "../utils/get-shebang.ts"
import undent from 'outdent'
import { dim } from "deno/fmt/colors.ts"
import { blurple } from "../utils/color.ts"
const { usePantry } = hooks

export default async function(pkgs: PackageRequirement[]) {
  const usrlocal = new Path("/usr/local/bin")
  let n = 0

  try {
    await write(usrlocal, pkgs)
  } catch (err) {
    if (err instanceof Deno.errors.PermissionDenied) {
      await write(Path.home().join(".local/bin"), pkgs)
    }
  }

  if (n == 0) {
    console.error('pkgx: no programs provided by pkgs')
  }

  async function write(dst: Path, pkgs: PackageRequirement[]) {
    for (const pkg of pkgs) {
      for (const program of await usePantry().project(pkg).provides()) {
        const pkgstr = utils.pkg.str(pkg)
        const exec = `exec pkgx +${pkgstr} -- ${program} "$@"`
        const f = dst.mkdir('p').join(program)

        if (f.exists()) {
          if (!f.isFile()) throw new PkgxError(`${f} already exists and is not a file`)

          const fd = is_shebang(f).catch(() => undefined)
          if (!fd) throw new PkgxError(`${f} already exists and is not a pkgx installation`)

          const lines = f.readLines()
          const { value: shebang } = await lines.next()
          if (shebang != "#!/bin/sh") {
            throw new PkgxError(`${f} already exists and is not a pkgx installation`)
          }
          const { value } = await lines.next()
          if (value == exec) {
            console.warn(`pkgx: already installed: ${blurple(program)} ${dim(`(${pkgstr})`)}`)
            n++
            continue
          }
          if (!value.startsWith('exec pkgx')) {
            throw new PkgxError(`${f} already exists and is not a pkgx installation`)
          }
        }

        f.write({ force: true, text: undent`
          #!/bin/sh
          ${exec}
          ` }).chmod(0o755)
        console.error('pkgx: installed:', f)
        n++
      }
    }
  }
}
