import { readLines } from "deno/io/read_lines.ts"
import { Path, PkgxError } from "pkgx"

export default async function(path: Path) {
  try {
    const fd = await is_shebang(path)
    if (!fd) return
    try {
      const shebang = (await readLines(fd).next()).value as string
      const parts = shebang.split(' ')

      const cmd = Path.abs(parts[0])?.basename()
      if (!cmd) throw new PkgxError("invalid shebang")

      if (cmd == 'env') {
        return parts.slice(parts[1] == '-S' ? 2 : 1)
      } else {
        return [cmd, ...parts.slice(1)]
      }
    } finally {
      fd.close()
    }
  } catch (err) {
    if (err instanceof Deno.errors.PermissionDenied) {
      // eg `pkgx sudo` will throw since it is not a readable file unless you are already root
      return
    } else {
      throw err
    }
  }
}

export async function is_shebang(path: Path): Promise<Deno.FsFile | undefined> {
  const fd = await Deno.open(path.string)
  const buf = new Uint8Array(2)

  if (await fd.read(buf) !== 2) {
    fd.close()
    return  // empty file
  }

  if (buf[0] != 35 || buf[1] != 33) {
    fd.close()
    return  // not an executable script
  }

  return fd
}