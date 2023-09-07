import { readLines } from "deno/io/read_lines.ts"
import { Path, TeaError } from "tea"

export default async function(path: Path) {
  try {
    const fd = await Deno.open(path.string)
    try {
      const buf = new Uint8Array(2)

      if (await fd.read(buf) !== 2) {
        return  // empty file
      }

      if (buf[0] != 35 || buf[1] != 33) {
        return  // not an executable script
      }
      const shebang = (await readLines(fd).next()).value as string
      const parts = shebang.split(' ')

      const cmd = Path.abs(parts[0])?.basename()
      if (!cmd) throw new TeaError("invalid shebang")

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
      // eg `tea sudo` will throw since it is not a readable file unless you are already root
      return
    } else {
      throw err
    }
  }
}
