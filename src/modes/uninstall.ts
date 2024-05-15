import parse_pkg_str from "../prefab/parse-pkg-str.ts"
import { hooks, PackageRequirement, Path, PkgxError, utils } from "pkgx"

export default async function(pkgspecs: string[]) {
  const pkgs = await Promise.all(pkgspecs.map(x => parse_pkg_str(x, {latest: 'ok'})))

  await uninstall(new Path("/usr/local/bin"), pkgs)
  await uninstall(Path.home().join(".local/bin"), pkgs)
}

async function uninstall(prefix: Path, pkgs: PackageRequirement[]) {
  for (const pkg of pkgs) {
    const programs = await hooks.usePantry().project(pkg).provides()
    const pkgstr = utils.pkg.str(pkg)
    const config = hooks.useConfig()
    const pkgdir = pkgstr.split("/").slice(0, -1).join("/")
    //FIXME: it removes the dir successfully. however, it still complains that it didn't delete that
    try {
      config.cache.join(`pkgx/envs/${pkgdir}`).rm({recursive: true})
    } catch (e) {
      console.warn(e);
    }
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
