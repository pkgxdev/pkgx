import { CStringArray, cstr } from "https://raw.githubusercontent.com/aapoalas/libclang_deno/1.0.0-beta.8/lib/utils.ts"
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

  const path = Deno.UnsafePointer.of(cstr(args[0]))
  const argv = arr_to_c(args)
  const envp = arr_to_c(Object.entries(env).map(([key, value]) => `${key}=${value}`))
  libc.symbols.execve(path, argv, envp)

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

  throw new Error("unexpected error")
}

function arr_to_c(arr: string[]): Deno.PointerValue {
  return Deno.UnsafePointer.of(new CStringArray([...arr, ""]))
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
