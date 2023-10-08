import parse_pkg_str from "../prefab/parse-pkg-str.ts"
import { hooks, PackageRequirement, Path, PkgxError } from "pkgx"

export default async function(pkgspecs: string[]) {
  const pkgs = await Promise.all(pkgspecs.map(x => parse_pkg_str(x, {latest: 'ok'})))

  await uninstall(new Path("/usr/local/bin"), pkgs)
  await uninstall(Path.home().join(".local/bin"), pkgs)
}

async function uninstall(prefix: Path, pkgs: PackageRequirement[]) {
  for (const pkg of pkgs) {
    const programs = await hooks.usePantry().project(pkg).provides()
    for (const program of programs) {
      const f = prefix.join(program)
      if (f.isFile()) {
        const cmd = new Deno.Command(f.string, {env: {PKGX_UNINSTALL: '1'}})
        const proc = await cmd.spawn().status
        if (!proc.success) {
          throw new PkgxError(`Couldn’t uninstall: ${f}`)
        }
      }
    }
  }
}
