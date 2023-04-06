import { basename } from "deno/path/mod.ts"
import { undent } from "utils"
import Path from "path"
import { useEnv } from "./hooks/useConfig.ts"

export default function(self: Path, shell?: string) {
  const { SHELL } = useEnv()
  shell ??= basename(SHELL ?? "unknown")
  const d = self.parent()

  switch (shell) {
  case "zsh":
    return undent`
      _tea_chpwd_hook() {
        if [ "\${TEA_MAGIC:-}" != 0 -a -x "${d}"/tea ]; then
          source <("${d}"/tea +tea.xyz/magic -Esk --chaste env)
        fi
      }

      if test "$TERM_PROGRAM" = WarpTerminal -o "$TERM_PROGRAM" = vscode; then
        # warp.dev & vscode integrated terminal don’t call the hook on startup
        _tea_chpwd_hook
      fi

      typeset -ag chpwd_functions

      if [[ -z "\${chpwd_functions[(r)_tea_hook]+1}" ]]; then
        chpwd_functions=( _tea_chpwd_hook \${chpwd_functions[@]} )
      fi

      if [[ "$PATH" != *"$HOME/.local/bin"* ]]; then
        export PATH="$HOME/.local/bin:$PATH"
      fi

      if ! command -v tea 2>&1 >/dev/null || ! tea --prefix 2>&1 >/dev/null; then
        export PATH="${d}:$PATH"
      fi

      function command_not_found_handler {
        if [ "\${TEA_MAGIC:-}" != 0 -a -x "${d}"/tea ]; then
          "${d}"/tea -- $*
        else
          echo "zsh: command not found: $*" >&2
          exit 127
        fi
      }
      `
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
        "${d}"/tea -- $argv
      end
      `
  case "bash":
    return undent`
      cd() {
        builtin cd "$@" || return
        source /dev/stdin <<<"$("${d}"/tea +tea.xyz/magic -Esk --chaste env)"
      }

      if [[ "$PATH" != *"$HOME/.local/bin"* ]]; then
        export PATH="$HOME/.local/bin:$PATH"
      fi

      if ! command -v tea 2>&1 >/dev/null || ! tea --prefix 2>&1 >/dev/null; then
        export PATH="${d}:$PATH"
      fi

      function command_not_found_handle {
        "${d}"/tea -- $*
      }
      `
    default:
      throw new Error("unsupported shell")
  }
}
