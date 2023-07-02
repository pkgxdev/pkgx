import { utils, Path, TeaError } from "tea"
const { host } = utils

export default function({cmd: args, env}: {cmd: string[], env: Record<string, string>}): Deno.Command {
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

  /// we need to forward any other env, some vars like HOME are super important
  /// but otherwise the user has set stuff so we should use it
  for (const [key, value] of Object.entries(Deno.env.toObject())) {
    env[key] ??= value
  }

  find_in_PATH(args, env.PATH)

  const path = cstr(args[0])
  const argv = new CStringArray(args)
  const envp = new CStringArray(Object.entries(env).map(([key, value]) => `${key}=${value}`))

  libc.symbols.execve(
    Deno.UnsafePointer.of(path),
    Deno.UnsafePointer.of(argv),
    Deno.UnsafePointer.of(envp))

  switch (libc.symbols.errno) {
    case 2:  //ENOENT:
      // yes: strange behavior from execve here indeed
      if (new Path(args[0]).exists()) {
        throw new Deno.errors.PermissionDenied()
      } else {
        throw new Deno.errors.NotFound()
      }
    case 13:
      throw new Deno.errors.PermissionDenied()
    case 7:  //E2BIG:
    case 14: //EFAULT:
    case 5:  //EIO:
    case 62: //ELOOP:
    case 63: //ENAMETOOLONG:
    case 8:  //ENOEXEC:
    case 12: //ENOMEM:
    case 20: //ENOTDIR:
    case 26: //ETXTBSY:
      throw new TeaError(`execve (${libc.symbols.errno})`)
  }

  throw new Error(`execve (${libc.symbols.errno})`)
}

function find_in_PATH(cmd: string[], PATH?: string) {
  if (cmd[0].startsWith("/")) {
    return
  }
  if (cmd[0].includes("/")) {
    cmd[0] = Path.cwd().join(cmd[0]).string
    return
  }

  PATH ??= "/usr/bin:/bin"  // see manpage for execvp(3)

  for (const part of PATH.split(':')) {
    const path = (part == '' || part == '.' ? Path.cwd() : new Path(part)).join(cmd[0])
    if (path.isExecutableFile()) {
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
  constructor(strings?: string[]) {
    if (!strings || strings.length === 0) {
      super();
      return;
    }
    let stringsLength = 0;
    for (const string of strings) {
      // Byte length of a UTF-8 string is never bigger than 3 times its length.
      // 2 times the length would be a fairly safe guess. For command line arguments,
      // we expect that all characters should be single-byte UTF-8 characters.
      // Add one byte for the null byte.
      stringsLength += string.length + 1;
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
      if (result.read !== result.written) {
        throw new Error("Not a single byte UTF-8 string");
      }
      offset = start + result.written + 1; // Leave null byte
      pointerBuffer[index++] = basePointer + BigInt(start);
    }
  }
}

export const cstr = (string: string): Uint8Array =>
  ENCODER.encode(`${string}\0`);
