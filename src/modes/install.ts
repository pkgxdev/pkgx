import { PackageRequirement, Path, PkgxError, hooks, utils } from "pkgx"
import { is_shebang } from "../utils/get-shebang.ts"
import { blurple, dim } from "../utils/color.ts"
import undent from 'outdent'
const { usePantry } = hooks

// * maybe impl `$XDG_BIN_HOME`

export function is_unsafe(unsafe: boolean): boolean {
  // `--unsafe` takes precedence over the `$PKGX_UNSAFE_INSTALL` flag
  const IS_UNSAFE = parseInt(Deno.env.get("PKGX_UNSAFE_INSTALL") || "0") ? true : unsafe;
  return IS_UNSAFE;
}

export default async function(pkgs: PackageRequirement[], unsafe: boolean) {
  const usrlocal = new Path("/usr/local/bin")
  let n = 0

  try {
    await write(usrlocal, pkgs)
  } catch (err) {
    //FIXME we should check if /usr/local/bin is writable, but were having trouble with that
    if (err instanceof Deno.errors.PermissionDenied) {
      const bindir = Path.home().join(".local/bin")
      await write(bindir, pkgs)
      if (n > 0 && !Deno.env.get("PATH")?.split(":").includes(bindir.string)) {
        console.warn("pkgx: %c`%s` is not in `PATH`", 'color: red', bindir)
      }
    } else {
      throw err
    }
  }

  if (n == 0) {
    console.error('pkgx: no programs provided by pkgs')
  }

  async function write(dst: Path, pkgs: PackageRequirement[]) {
    const UNSAFE = is_unsafe(unsafe);
    for (const pkg of pkgs) {
      const programs = await usePantry().project(pkg).provides()
      program_loop:
      for (const program of programs) {

        // skip for now since we would require specific versions and we haven't really got that
        if (program.includes("{{")) continue

        const pkgstr = utils.pkg.str(pkg)
        if (UNSAFE) {
          const parts = pkgstr.split("/")
          parts.pop()
          await Deno.mkdir(Path.home().join(`.cache/pkgx/envs/${parts.join("/")}`).toString(), {recursive: true})
        }
        //FIXME: doing `set -a` clears the args env
        const exec = UNSAFE ? undent`
            ARGS="$@"
            pkgx_resolve() {
              mkdir -p "$(dirname \\"$\{XDG_CACHE_DIR:-$HOME/.cache\}/pkgx/envs/${pkgstr}.env\\")"
              pkgx +${pkgstr} 1>"$\{XDG_CACHE_DIR:-$HOME/.cache\}/pkgx/envs/${pkgstr}.env"
              run
            }
            run() {
              if [[ -e "$\{XDG_CACHE_DIR:-$HOME/.cache\}/pkgx/envs/${pkgstr}.env" && -e "$\{PKGX_HOME:-$HOME/.pkgx\}/${pkgstr}/v*/bin/${program}" ]]; then
                set -a
                source "$\{XDG_CACHE_DIR:-$HOME/.cache\}/pkgx/envs/${pkgstr}.env"
                exec "$\{PKGX_HOME:-$HOME/.pkgx\}/${pkgstr}/v*/bin/${program}" "$ARGS"
              else
                pkgx_resolve
              fi
            }
            run
          ` : `exec pkgx +${pkgstr} -- ${program} "$@"`
        const script = undent`
          if [ "$PKGX_UNINSTALL" != 1 ]; then
            ${exec}
          else
            cd "$(dirname "$0")"
            rm ${programs.join(' ')} && echo "uninstalled: ${pkgstr}" >&2
          fi`
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
          while (true) {
            const { value, done } = await lines.next()
            if (done) {
              throw new PkgxError(`${f} already exists and is not a pkgx installation`)
            }
            const found = value.match(/^\s*pkgx \+([^ ]+)/)?.[1]
            if (found) {
              n++
              console.warn(`pkgx: already installed: ${blurple(program)} ${dim(`(${found})`)}`)
              continue program_loop
            }
          }
        }

        f.write({ force: true, text: undent`
          #!/bin/sh
          ${script}`
        }).chmod(0o755)
        console.error('pkgx: installed:', f)
        n++
      }
    }
  }
}
