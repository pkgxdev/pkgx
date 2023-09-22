import { ProgrammerError } from "./error.ts"
import { utils, Path, PkgxError } from "pkgx"
const { host } = utils

export default function({cmd: args, env}: {cmd: string[], env: Record<string, string>}): never {
  /// we need to forward any other env, some vars like HOME are super important
  /// but otherwise the user has set stuff so we should use it
  for (const [key, value] of Object.entries(Deno.env.toObject())) {
    env[key] ??= value
  }

  find_in_PATH(args, env.PATH, Path.abs(env.HOME))

  const path = cstr(args[0])
  const argv = new CStringArray(args)
  const envp = new CStringArray(Object.entries(env).map(([key, value]) => `${key}=${value}`))

  const errno = _internals.execve(
    Deno.UnsafePointer.of(path),
    Deno.UnsafePointer.of(argv),
    Deno.UnsafePointer.of(envp))

  switch (errno) {
    case 2:  //ENOENT:
      // yes: strange behavior from execve here indeed
      if (parse_Path(args[0])?.exists()) {
        throw new Deno.errors.PermissionDenied()
      } else {
        throw new Deno.errors.NotFound()
      }
    case 13:
    case 316:  //FIXME ALERT! ALERT! BUG! SOMETHING IS WRONG WITH OUR USE OR ERRNO AND THIS SOMETIMES RESULTS :/
      throw new Deno.errors.PermissionDenied()
    case 63: //ENAMETOOLONG:
    case 7:  //E2BIG:
    case 14: //EFAULT:
    case 5:  //EIO:
    case 62: //ELOOP:
    case 8:  //ENOEXEC:
    case 12: //ENOMEM:
    case 20: //ENOTDIR:
    case 26: //ETXTBSY:
      throw new PkgxError(`execve (${errno})`)
  }

  throw new ProgrammerError(`execve (${errno})`)
}

export function parse_Path(input: string) {
  const p = Path.abs(input)
  if (p) return p
  try {
    return _internals.getcwd().join(input)
  } catch {
    return
  }
}

function find_in_PATH(cmd: string[], PATH: string | undefined, HOME: Path | undefined) {
  if (cmd[0].startsWith("/")) {
    return
  }
  if (cmd[0].includes("/")) {
    cmd[0] = _internals.getcwd().join(cmd[0]).string
    return
  }

  PATH ??= "/usr/bin:/bin"  // see manpage for execvp(3)

  for (const part of PATH.split(':')) {
    const path = (() => {
      if (part == '.') return _internals.getcwd()
      if (part == '~') return HOME
      if (part.startsWith('~/')) return HOME?.join(part.slice(2))
      //FIXME: not handled: ~user/...
      return new Path(part)
    })()?.join(cmd[0])
    if (path?.isExecutableFile()) {
      cmd[0] = path.string
      return
    }
  }
}


////// COPY PASTA
// actually minor mods to add trailing null
// https://github.com/aapoalas/libclang_deno/blob/main/lib/utils.ts

const ENCODER = new TextEncoder();

export class CStringArray extends Uint8Array {
  constructor(strings: string[]) {
    let stringsLength = 0;
    for (const string of strings) {
      // maximum bytes for a utf8 string is 4×length
      stringsLength += string.length * 4 + 1;
    }
    super(8 * (strings.length + 1) + stringsLength);
    const pointerBuffer = new BigUint64Array(this.buffer, 0, strings.length + 1);
    const stringsBuffer = new Uint8Array(this.buffer).subarray(
      (strings.length + 1) * 8,
    );
    const basePointer = BigInt(
      Deno.UnsafePointer.value(Deno.UnsafePointer.of(stringsBuffer)),
    );
    let index = 0;
    let offset = 0;
    for (const string of strings) {
      const start = offset;
      const result = ENCODER.encodeInto(
        string,
        stringsBuffer.subarray(start),
      );
      offset = start + result.written + 1; // Leave null byte
      pointerBuffer[index++] = basePointer + BigInt(start);
    }
  }
}

export const cstr = (string: string): Uint8Array =>
  ENCODER.encode(`${string}\0`);

function execve(arg0: Deno.PointerValue, args: Deno.PointerValue, env: Deno.PointerValue) {
  const filename = host().platform == 'darwin' ? '/usr/lib/libSystem.dylib' : 'libc.so.6'

  const libc = Deno.dlopen(
    filename, {
      execve: {
        parameters: ["pointer", "pointer", "pointer"],
        result: "i32"
      },
      errno: {
        type: "i32"
      }
    }
  )

  try {
    libc.symbols.execve(arg0, args, env)
    return libc.symbols.errno
  } finally {
    libc.close()
  }
}

export const _internals = {
  execve,
  getcwd: Path.cwd
}
