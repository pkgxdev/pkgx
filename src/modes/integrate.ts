import { writeAll } from "deno/streams/write_all.ts"
import { readAll } from "deno/streams/read_all.ts"
import { readLines } from "deno/io/read_lines.ts"
import { Path, PkgxError, utils } from "pkgx"
import announce from "../utils/announce.ts"
import shellcode from "./shellcode.ts"
const { flatmap, host } = utils

//TODO could be a fun efficiency excercise to maintain a separate write file-pointer
//FIXME assumes unix line-endings

export default async function(op: 'install' | 'uninstall', { dryrun }: { dryrun: boolean }) {
  let opd_at_least_once = false
  const encode = (e => e.encode.bind(e))(new TextEncoder())

  const fopts = { read: true, ...dryrun ? {} : {write: true, create: true} }

  here: for (const [file, line] of shells()) {
    const fd = await Deno.open(file.string, fopts)
    try {
      let pos = 0
      for await (const readline of readLines(fd)) {
        if (readline.trim().endsWith('#docs.pkgx.sh/shellcode')) {
          if (op == 'install') {
            _internals.stderr("hook already integrated:", file)
            continue here
          } else if (op == 'uninstall') {
            // we have to seek because readLines is buffered and thus the seek pos is probs already at the file end
            await fd.seek(pos + readline.length + 1, Deno.SeekMode.Start)
            const rest = await readAll(fd)

            if (!dryrun) await fd.truncate(pos)  // deno has no way I can find to truncate from the current seek position
            await fd.seek(pos, Deno.SeekMode.Start)
            if (!dryrun) await writeAll(fd, rest)

            opd_at_least_once = true
            _internals.stderr("removed hook:", file)

            continue here
          }
        }

        pos += readline.length + 1  // the +1 is because readLines() truncates it
      }

      if (op == 'install') {
        const byte = new Uint8Array(1)
        if (pos) {
          await fd.seek(0, Deno.SeekMode.End)  // potentially the above didn't reach the end
          while (true && pos > 0) {
            await fd.seek(-1, Deno.SeekMode.Current)
            await fd.read(byte)
            if (byte[0] != 10) break
            await fd.seek(-1, Deno.SeekMode.Current)
            pos -= 1
          }

          if (!dryrun) await writeAll(fd, encode(`\n\n${line}  #docs.pkgx.sh/shellcode\n`))
        }
        opd_at_least_once = true
        _internals.stderr(`${file} << \`${line}\``)
      }
    } finally {
      fd.close()
    }
  }
  if (dryrun && opd_at_least_once) {
    const instruction = op == 'install' ? 'eval "$(pkgx integrate)"' : 'pkgx deintegrate'
    _internals.stderr()
    announce({
      title: 'this was a dry-run',
      subtitle: 'to actually perform the above, run:',
      body: [[],[`  ${instruction}`],[]],
      help: 'https://docs.pkgx.sh/shell-integration'
    })
  } else switch (op) {
  case 'uninstall':
    if (!opd_at_least_once) {
      _internals.stderr("nothing to deintegrate found")
    }
    break
  case 'install':
    if (!_internals.isatty(Deno.stdout.rid)) {
      // we're being sourced, output the hook
      _internals.stdout(shellcode())
    } else if (opd_at_least_once) {
      _internals.stderr("%crestart your terminal%c for `pkgx` hooks to take effect", 'color: #5f5fff', 'color: initial')
    }
  }
}

function shells(): [Path, string][] {
  const { home, host } = _internals

  const zdotdir = flatmap(Deno.env.get("ZDOTDIR"), Path.abs) ?? home()
  //const xdg_dir = flatmap(Deno.env.get("XDG_CONFIG_HOME"), Path.abs) ?? _internals.home().join(".config")

  const std = (_shell: string) => `source <(pkgx --shellcode)`

  const bash = 'eval "$(pkgx --shellcode)"'
  const zshpair: [Path, string] = [zdotdir.join(".zshrc"), std("zsh")]

  const candidates: [Path, string][] = [
    zshpair,
    [home().join(".bashrc"), bash],
    [home().join(".bash_profile"), bash],
    // [xdg_dir.join("elvish/rc.elv"), std("elvish")],
    // [xdg_dir.join("fish/config.fish"), "pkgx --hook | source"],
  ]

  const viable_candidates = candidates.filter(([file]) => file.exists())

  if (viable_candidates.length == 0) {
    if (host().platform == 'darwin') {
      /// macOS has no .zshrc by default and we want mac users to get a just works experience
      return [zshpair]
    } else {
      throw new PkgxError("no `.shellrc` files found")
    }
  }

  return viable_candidates
}

export const _internals = {
  home: Path.home,
  host,
  isatty: Deno.isatty,
  stdout: console.log,
  stderr: console.error
}
