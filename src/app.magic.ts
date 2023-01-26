import { basename } from "deno/path/mod.ts"
import { undent } from "utils"
import Path from "path"

export default function(self: Path, shell?: string) {
  shell ??= basename(Deno.env.get("SHELL") ?? "unknown")
  const d = self.parent()

  switch (shell) {
  case "zsh":
    return undent`
      add-zsh-hook -Uz chpwd() {
        if [ "\${TEA_MAGIC:-}" != 0 -a -x "${d}"/tea ]; then
          source <("${d}"/tea +tea.xyz/magic -Esk --chaste env)
        fi
      }

      # if the user put tea in eg. /usr/local/bin then don’t pollute their PATH
      # we check for \`tea --prefix\` due to \`gitea\` being \`tea\` when installed with \`brew\`
      if ! command -v tea 2>&1 >/dev/null || ! tea --prefix 2>&1 >/dev/null; then
        export PATH="${d}:$PATH"
      fi

      function command_not_found_handler {
        if [ "\${TEA_MAGIC:-}" != 0 -a -x "${d}"/tea ]; then
          "${d}"/tea -- $*
        fi
      }
      `
  case "fish":
    return undent`
      function add_tea_environment --on-variable PWD
        "${d}"/tea --env --keep-going --silent --dry-run=w/trace | source
      end

      # if the user put tea in eg. /usr/local/bin then don’t pollute their PATH
      # we check for \`tea --prefix\` due to \`gitea\` being \`tea\` when installed with \`brew\`
      if ! command -v tea 2>&1 >/dev/null || ! tea --prefix 2>&1 >/dev/null; then
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
        if [ "$OLDPWD" != "$PWD" ]; then
          source <("${d}"/tea +tea.xyz/magic -Esk --chaste env)
        fi
      }

      # if the user put tea in eg. /usr/local/bin then don’t pollute their PATH
      # we check for \`tea --prefix\` due to \`gitea\` being \`tea\` when installed with \`brew\`
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
