import { basename } from "deno/path/mod.ts"
import { undent } from "utils"
import Path from "path"

export default function(self: Path) {
  const shell = basename(Deno.env.get("SHELL") ?? "")
  const d = self.parent()

  switch (shell) {
  case "zsh":
    return undent`
      # this file is generated and should not be edited

      function command_not_found_handler {
        if [ "\${TEA_MAGIC:-}" != 0 -a -x "${d}"/tea ]; then
          "${d}"/tea -- $*
        fi
      }

      add-zsh-hook -Uz chpwd() {
        if [ "\${TEA_MAGIC:-}" != 0 -a -x "${d}"/tea ]; then
          source <("${d}"/tea --env --keep-going --silent --dry-run=w/trace)
        fi
      }

      # if the user put tea in eg. /usr/local/bin then don’t pollute their PATH
      if ! tea true 2>&1 >/dev/null; then
        export PATH="${d}:$PATH"
      fi
      `
  case "fish":
    return undent`
      # this file is generated and should not be edited

      function add_tea_environment --on-variable PWD
        "${d}"/tea --env --keep-going --silent --dry-run=w/trace | source
      end

      function fish_command_not_found
        "${d}"/tea -- $argv
      end

      # if the user put tea in eg. /usr/local/bin then don’t pollute their PATH
      if ! tea true 2>&1 >/dev/null; then
        export PATH="${d}:$PATH"
      end
      `
  case "bash":
    return undent`
      # this file is generated and should not be edited

      cd() {
        builtin cd "$@" || return
        if [ "$OLDPWD" != "$PWD" ]; then
          source <("${d}"/tea --env --keep-going --silent --dry-run=w/trace)
        fi
      }

      function command_not_found_handle {
        "${d}"/tea -- $*
      }

      # if the user put tea in eg. /usr/local/bin then don’t pollute their PATH
      if ! tea true 2>&1 >/dev/null; then
        export PATH="${d}:$PATH"
      fi
      `
    default:
      throw new Error("unsupported shell")
  }
}
