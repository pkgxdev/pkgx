import { basename } from "deno/path/mod.ts"
import { Path, TeaError } from "tea"
import { useConfig } from "hooks"
import undent from "outdent"

export default function(self: Path, shell?: string) {
  const { SHELL } = useConfig().env
  shell ??= basename(SHELL ?? "unknown")
  const d = self.parent()

  switch (shell) {
  case "zsh":
    return zsh(d)
  case "elvish":
    // eval ($MAGIC | slurp)
    return undent`
      set after-chdir = [ $@after-chdir { |dir|
        eval ("${d}"/tea +tea.xyz/magic -Esk --chaste env | slurp)
      }]

      # insert env for current dir too
      eval ("${d}"/tea +tea.xyz/magic -Esk --chaste env | slurp)

      if not (echo $PATH | split ':' | each [p]{ has-prefix $p $HOME/.local/bin }) {
        echo "$HOME/.local/bin is not in PATH"
      }

      if (not (has-external tea)) {
        set paths = [
          ${d}
          $@paths
        ]
      }

      # command-not-found
      set edit:after-command = [ $@edit:after-command { |m|
        var error = $m[error]
        var src = $m[src]

        if (not-eq $error $nil) {
          var reason

          try {
            set reason = $error[reason]
          } catch {
            set reason = ""
          }

          use str
          if (str:has-prefix (repr $reason) "<unknown exec:") {
            "${d}"/tea (str:split &max=-1 ' ' $src[code])
          }
        }
      }]
      `
  case "fish":
    return undent`
      function add_tea_environment --on-variable PWD
        "${d}"/tea --env --keep-going --silent --dry-run=w/trace | source
      end

      if not string match -q -r "^$HOME/.local/bin(:|\\$)" $PATH
        export PATH="$HOME/.local/bin:$PATH"
      end

      if ! command -v tea 2>&1 >/dev/null || ! tea --prefix 2>&1 >/dev/null
        export PATH="${d}:$PATH"
      end

      function fish_command_not_found
        TEA_MAGIC="abracadabra:$TEA_MAGIC" "${d}"/tea -- $argv
      end

      "${d}"/tea --env --keep-going --silent --dry-run=w/trace | source
      `
  case "bash":
    return bash(d)
  default:
    return undent`
      if test -n "$BASH_VERSION"; then
        ${bash(d)}
      elif test -n "$ZSH_VERSION"; then
        ${zsh(d)}
      else
        echo "tea: error: unknown shell" >&2
        exit 1
      fi
      `
  }
}

function zsh(bindir: Path) {
  return undent`
    _xyz_tea_chpwd_hook() {
      if [ "\${TEA_MAGIC:-}" != 0 -a -x "${bindir}"/tea ]; then
        source <("${bindir}"/tea +tea.xyz/magic -Esk --chaste env)
      fi
    }

    if test "$TERM_PROGRAM" != Apple_Terminal; then
      # Apple’s app calls this hook itself, but nothing else seems to
      _xyz_tea_chpwd_hook
    fi

    typeset -ag chpwd_functions

    if [[ -z "\${chpwd_functions[(r)_tea_hook]+1}" ]]; then
      chpwd_functions=( _xyz_tea_chpwd_hook \${chpwd_functions[@]} )
    fi

    # add our shims to the PATH
    TEA_PREFIX="\${TEA_PREFIX:-$HOME/.tea}"
    if [[ "$PATH" != *"$TEA_PREFIX/.local/bin"* ]]; then
      export PATH="$TEA_PREFIX/.local/bin:$PATH"
    fi

    # we configure eg. \`npm i -g\`, cargo, etc. to install here
    if [[ "$PATH" != *"$HOME/.local/bin"* ]]; then
      export PATH="$HOME/.local/bin:$PATH"
    fi

    if ! command -v tea 2>&1 >/dev/null; then
      export PATH="${bindir}:$PATH"
    fi

    _has_tea_magic() {
      [ "\${TEA_MAGIC:-}" != 0 -a -x "${bindir}"/tea ]
    }

    function command_not_found_handler {
      if _has_tea_magic; then
        TEA_MAGIC="abracadabra:$TEA_MAGIC" "${bindir}"/tea -- $*
      else
        echo "zsh: command not found: $*" >&2
        exit 127
      fi
    }

    function _tea_completion {
      local completions

      if _has_tea_magic; then
        # Call \`tea --complete\` with the current word as the prefix
        completions=($(tea --complete \${words[CURRENT]}))
        if [[ -n "\${completions}" ]]; then
          _describe "tea" completions
        fi
      fi
    }

    function _tea_command_names {
      _tea_completion "$@"
      _command_names
    }

    function _tea_completion_wrapper {
      _tea_command_names "$@"
    }

    autoload -Uz compinit
    compinit
    compdef _tea_completion_wrapper -command-
    `
}

function bash(bindir: Path) {
  return undent`
    _xyz_tea_chpwd_hook() {
      source /dev/stdin <<<"$("${bindir}"/tea +tea.xyz/magic -Esk --chaste env)"
    }

    cd() {
      builtin cd "$@" || return
      _xyz_tea_chpwd_hook
    }

    # add our shims to the PATH
    TEA_PREFIX="\${TEA_PREFIX:-$HOME/.tea}"
    if [[ "$PATH" != *"$TEA_PREFIX/.local/bin"* ]]; then
      export PATH="$TEA_PREFIX/.local/bin:$PATH"
    fi

    if [[ "$PATH" != *"$HOME/.local/bin"* ]]; then
      export PATH="$HOME/.local/bin:$PATH"
    fi

    if ! command -v tea 2>&1 >/dev/null || ! tea --prefix 2>&1 >/dev/null; then
      export PATH="${bindir}:$PATH"
    fi

    function command_not_found_handle {
      TEA_MAGIC="abracadabra:$TEA_MAGIC" "${bindir}"/tea -- $*
    }
    `
}

import { readLines } from "deno/io/read_lines.ts"
import { readAll } from "deno/streams/read_all.ts"
import { writeAll } from "deno/streams/write_all.ts"
import { flatmap } from "tea/utils/misc.ts";


//TODO could be a fun efficiency excercise to maintain a separate write file-pointer
//TODO assumes unix line-endings
export async function install_magic(op: 'install' | 'uninstall') {
  let opd_at_least_once = false
  const encode = (() => { const e = new TextEncoder(); return e.encode.bind(e) })()

  here: for (const [file, line] of shells()) {
    const fd = await Deno.open(file.string, {read: true, write: true})
    try {
      let pos = 0
      for await (const readline of readLines(fd)) {
        if (readline.trim() == line) {
          if (op == 'install') {
            console.info("magic already installed:", file)
            continue here
          } else if (op == 'uninstall') {
            // we have to seek because readLines is buffered and thus the seek pos is probs already at the file end
            fd.seek(pos + readline.length + 1, Deno.SeekMode.Start)
            const rest = await readAll(fd)

            await fd.truncate(pos)  // deno has no way I can find to truncate from the current seek position
            fd.seek(pos, Deno.SeekMode.Start)
            await writeAll(fd, rest)

            opd_at_least_once = true
            console.info("removed magic:", file)

            continue here
          }
        }

        pos += readline.length + 1  // the +1 is because readLines() truncates it
      }

      if (op == 'install') {
        const byte = new Uint8Array(1)
        fd.seek(0, Deno.SeekMode.End)  // potentially the above didn't reach the end
        while (true) {
          fd.seek(-1, Deno.SeekMode.Current)
          await fd.read(byte)
          if (byte[0] != 10) break
          fd.seek(-1, Deno.SeekMode.Current)
        }

        await writeAll(fd, encode(`\n\n${line}\n`))

        console.info("magic installed:", file)
      }
    } finally {
      fd.close()
    }
  }

  if (op == 'uninstall' && !opd_at_least_once) {
    console.info("magic already not installed")
  }
}

function shells(): [Path, string][] {
  const zdotdir = flatmap(Deno.env.get("ZDOTDIR"), Path.abs) ?? Path.home()
  const xdg_dir = flatmap(Deno.env.get("XDG_CONFIG_HOME"), Path.abs) ?? Path.home().join(".config")

  const std = (shell: string) => `source <(tea --magic=${shell})  #docs.tea.xyz/magic`

  const candidates: [Path, string][] = [
    [zdotdir.join(".zshrc"), std("zsh")],
    [Path.home().join(".bash_profile"), 'source /dev/stdin <<<"$(tea --magic=bash)  #docs.tea.xyz/magic'],
    [xdg_dir.join("elvish/rc.elv"), std("elvish")],
    [xdg_dir.join("fish/config.fish"), "tea --magic=fish | source  #docs.tea.xyz/magic"],
  ]

  const viable_candidates = candidates.filter(([file]) => file.exists())

  if (viable_candidates.length == 0) {
    throw new TeaError("no shell rc files found to install magic into")
  }

  return viable_candidates
}
