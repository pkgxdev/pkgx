import useConfig from 'pkgx/hooks/useConfig.ts'
import undent from 'outdent'
import { Path } from 'pkgx'
import { flatmap } from "pkgx/utils/misc.ts";

// NOTES
// * is safely re-entrant (and idempotent)
// * we `eval` for BASH/ZSH because otherwise parsing fails for POSIX `sh`
// * we add `~/.local/bin` to `PATH` because we eg `npm i -g` is configured to install there
// * `command_not_found_handler` cannot change the global environment hence we write a file

// TODO
// * maybe impl `$XDG_BIN_HOME`
//   ref https://gitlab.freedesktop.org/xdg/xdg-specs/-/issues/14
// * remove the files we create for command not found handler once any prompt appears
// * need to use a proper tmp location perhaps

export default function() {
  const blurple = (x: string) => `\\033[38;5;63m${x}\\033[0m`
  const dim = (x: string) => `\\e[2m${x}\\e[0m`
  const datadir = useConfig().data.join("dev")
  const tmp = (flatmap(Deno.env.get("XDG_STATE_HOME"), Path.abs) ?? Path.home().join(".local", "state")).join("pkgx")
  const sh = '${SHELL:-/bin/sh}'

  return undent`
    pkgx() {
      case "$1" in
      install)
        if [ $# -gt 1 ]; then
          command pkgx "$@"
        elif type _pkgx_install >/dev/null 2>&1; then
          _pkgx_install
        else
          echo "pkgx: nothing to install" >&2
          return 1
        fi;;
      unload)
        if type _pkgx_reset >/dev/null 2>&1; then
          _pkgx_reset
        fi
        unset -f _pkgx_chpwd_hook _pkgx_should_deactivate_devenv pkgx x command_not_found_handler pkgx@latest _pkgx_commit _pkgx_dev_off >/dev/null 2>&1
        echo "pkgx: shellcode unloaded" >&2;;
      *)
        command pkgx "$@";;
      esac
    }

    x() {
      case $1 in
      "")
        if [ -f "${tmp}/shellcode/x.$$" ]; then
          eval "$(${sh} "${tmp}/shellcode/u.$$" --hush)"
          ${sh} "${tmp}/shellcode/x.$$"
          rm "${tmp}/shellcode/"?.$$
        else
          echo "pkgx: nothing to run" >&2
        fi;;
      *)
        command pkgx -- "$@";;
      esac
    }

    env() {
      for arg in "$@"; do
        case $arg in
        --*)
          command env "$@"
          return;;
        -*);;
        +*);;
        *)
          command env "$@"
          return;;
        esac
      done
      if [ $# -eq 0 ]; then
        command env
      fi
      if type _pkgx_reset >/dev/null 2>&1; then
        _pkgx_reset
      fi
      eval "$(command pkgx --internal.use "$@")"
    }

    dev() {
      if [ "$1" = 'off' ]; then
        _pkgx_dev_off
      elif type _pkgx_dev_off >/dev/null 2>&1; then
        echo 'dev: environment already active' >&2
        return 1
      else
        if type _pkgx_reset >/dev/null 2>&1; then
          _pkgx_reset
        fi
        eval "$(command pkgx --internal.activate "$PWD" "$@")"
      fi
    }

    command_not_found_handler() {
      if [ "$1" = pkgx ]; then
        echo 'fatal: \`pkgx\` not in PATH' >&2
        return 1
      elif command pkgx --silent --provider "$1"; then
        echo -e '${dim('^^ type `')}x${dim('` to run that')}' >&2

        d="${tmp}/shellcode"
        mkdir -p "$d"
        echo "echo -e \\"${blurple('env')} +$1 ${dim('&&')} $@ \\" >&2" > "$d/u.$$"
        echo "exec pkgx --internal.use +\\"$1\\"" >> "$d/u.$$"
        echo -n "exec " > "$d/x.$$"
        for arg in "$@"; do
          printf "%q " "$arg" >> "$d/x.$$"
        done
      else
        echo "cmd not found: $1" >&2
        return 127
      fi
    }

    _pkgx_chpwd_hook() {
      if _pkgx_should_deactivate_devenv >/dev/null 2>&1; then
        _pkgx_dev_off --shy
      fi
      if ! type _pkgx_dev_off >/dev/null 2>&1; then
        dir="$PWD"
        while [ "$dir" != "/" ]; do
          if [ -f "${datadir}/$dir/dev.pkgx.activated" ]; then
            if type _pkgx_reset >/dev/null 2>&1; then
              _pkgx_reset
            fi
            eval "$(command pkgx --internal.activate "$dir")"
            break
          fi
          dir="$(dirname "$dir")"
        done
      fi
    }

    if [ -n "$ZSH_VERSION" ] && [ $(emulate) = zsh ]; then
      eval 'typeset -ag chpwd_functions

            if [[ -z "\${chpwd_functions[(r)_pkgx_chpwd_hook]+1}" ]]; then
              chpwd_functions=( _pkgx_chpwd_hook \${chpwd_functions[@]} )
            fi

            if [ "$TERM_PROGRAM" != Apple_Terminal ]; then
              _pkgx_chpwd_hook
            fi

            _pkgx() {
              local words
              words=($(pkgx --shell-completion $1))
              reply=($words)
            }
            compctl -K _pkgx pkgx'
    elif [ -n "$BASH_VERSION" ] && [ "$POSIXLY_CORRECT" != y ] ; then
      eval 'cd() {
              builtin cd "$@" || return
              _pkgx_chpwd_hook
            }

            _pkgx_chpwd_hook'
    else
      POSIXLY_CORRECT=y
      echo "pkgx: warning: unsupported shell" >&2
    fi

    if [ "$POSIXLY_CORRECT" != y ]; then
      eval 'pkgx@latest() {
              command pkgx pkgx@latest "$@"
            }'
      if [[ "$PATH" != *"$HOME/.local/bin"* ]]; then
        export PATH="$HOME/.local/bin:$PATH"
      fi
    fi
    `
}
