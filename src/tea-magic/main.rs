use std::{env, path::PathBuf};

fn main() {
    let exe = env::current_exe().unwrap();
    let shell = env::args().nth(1);

    magic(exe, shell);
}

fn magic(exe: PathBuf, shell: Option<String>) {
    let shell = if let Some(s) = shell {
        s
    } else {
        env::var("SHELL").unwrap_or("unknown".to_string())
    };

    let base_path = exe.parent().unwrap().display().to_string();

    let magic = match shell.as_str() {
        "zsh" => {
            format!(
                "add-zsh-hook -Uz chpwd() {{
  if [ \"${{TEA_MAGIC:-}}\" != 0 -a -x \"{base_path}\"/tea ]; then
    source <(\"{base_path}\"/tea +tea.xyz/magic -Esk --chaste env)
  fi
}}

# if the user put tea in eg. /usr/local/bin then don’t pollute their PATH
# we check for `tea --prefix` due to `gitea` being `tea` when installed with `brew`
if ! command -v tea 2>&1 >/dev/null || ! tea --prefix 2>&1 >/dev/null; then
  export PATH=\"{base_path}:$PATH\"
fi

function command_not_found_handler {{
  if [ \"${{TEA_MAGIC:-}}\" != 0 -a -x \"{base_path}\"/tea ]; then
    \"{base_path}\"/tea -- $*
  fi
}}"
            )
        }
        "elvish" => {
            format!(
                "set after-chdir = [ $@after-chdir {{ |dir|
  eval (\"{base_path}\"/tea +tea.xyz/magic -Esk --chaste env | slurp)
}}]

# insert env for current dir too
eval (\"{base_path}\"/tea +tea.xyz/magic -Esk --chaste env | slurp)

# if the user put tea in eg. /usr/local/bin then don’t pollute their PATH
if (not (has-external tea)) {{
  set paths = [
    {base_path}
    $@paths
  ]
}}

# command-not-found
set edit:after-command = [ $@edit:after-command {{ |m|
  var error = $m[error]
  var src = $m[src]

  if (not-eq $error $nil) {{
    var reason

    try {{
      set reason = $error[reason]
    }} catch {{
      set reason = \"\"
    }}

    use str
    if (str:has-prefix (repr $reason) \"<unknown exec:\") {{
      \"{base_path}\"/tea (str:split &max=-1 ' ' $src[code])
    }}
  }}
}}]"
            )
        }
        "fish" => {
            format!(
                "function add_tea_environment --on-variable PWD
  \"{base_path}\"/tea --env --keep-going --silent --dry-run=w/trace | source
end

# if the user put tea in eg. /usr/local/bin then don’t pollute their PATH
# we check for `tea --prefix` due to `gitea` being `tea` when installed with `brew`
if ! command -v tea 2>&1 >/dev/null || ! tea --prefix 2>&1 >/dev/null
  export PATH=\"{base_path}:$PATH\"
end

function fish_command_not_found
  \"{base_path}\"/tea -- $argv
end"
            )
        }
        "bash" => {
            format!(
                "cd() {{
  builtin cd \"$@\" || return
  if [ \"$OLDPWD\" != \"$PWD\" ]; then
    source <(\"{base_path}\"/tea +tea.xyz/magic -Esk --chaste env)
  fi
}}

# if the user put tea in eg. /usr/local/bin then don’t pollute their PATH
# we check for `tea --prefix` due to `gitea` being `tea` when installed with `brew`
if ! command -v tea 2>&1 >/dev/null || ! tea --prefix 2>&1 >/dev/null; then
  export PATH=\"{base_path}:$PATH\"
fi

function command_not_found_handle {{
  \"{base_path}\"/tea -- $*
}}"
            )
        }
        _ => {
            format!("unsupported shell")
        }
    };
    println!("{}", magic);
}
