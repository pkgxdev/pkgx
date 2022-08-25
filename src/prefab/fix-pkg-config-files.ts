import { Installation } from "types"
import { Path } from "../types.ts"


export default async function fix_pkg_config_files(installation: Installation) {
  for await (const pcfile of find_pkg_config_files(installation)) {
    const orig = await pcfile.read()
    const relative_path = installation.path.relative({ to: pcfile.parent() })
    const text = orig.replace(installation.path.string, `\${pcfiledir}/${relative_path}`)
    if (orig !== text) {
      console.verbose({ fixed: pcfile })
      pcfile.write({text, force: true})
    }
  }
}

//NOTE currently we only support pc files in lib/pkgconfig
// we aim to standardize on this but will relent if a package is found
// that uses share and other tools that build against it only accept that
async function *find_pkg_config_files(installation: Installation): AsyncIterable<Path> {
  const pcdir = installation.path.join("lib/pkgconfig")
  if (!pcdir.isDirectory()) return
  for await (const [path, { isFile }] of pcdir.ls()) {
    if (isFile && path.extname() == ".pc") {
      yield path
    }
  }
}
