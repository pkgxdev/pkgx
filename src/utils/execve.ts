import { utils, Path, TeaError } from "tea"
const { host } = utils

export default function({cmd: argv, env}: {cmd: string[], env: Record<string, string>}) {
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
  const openv = Deno.env.toObject()
  for (const key in openv) {
    if (!(key in env)) {
      env[key] = openv[key]
    }
  }

  find_in_PATH(argv, env.PATH)

  const command = Deno.UnsafePointer.of(new TextEncoder().encode(`${argv[0]}\0`))
  const env_ = Object.entries(env).map(([key, value]) => `${key}=${value}\0`)

  libc.symbols.execve(command, arr_to_c(argv), arr_to_c(env_))

  switch (libc.symbols.errno) {
    case 2:  //ENOENT:
      // yes: strange behavior from execve here indeed
      if (new Path(argv[0]).exists()) {
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
      throw new TeaError(`execve failed (${libc.symbols.errno})`)
  }
}

function arr_to_c(arr: string[]): Deno.PointerValue {
  //TODO word size may not be 4 bytes!
  const argv_ = new BigUint64Array((arr.length + 1) * 4)
  for (let i = 0; i < arr.length; i++) {
    const a = new TextEncoder().encode(`${arr[i]}\0`)
    const b = Deno.UnsafePointer.of(a)
    const c = Deno.UnsafePointer.value(b)

    argv_.set([BigInt(c)], i)
  }
  argv_[arr.length] = 0n
  return Deno.UnsafePointer.of(argv_)
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
