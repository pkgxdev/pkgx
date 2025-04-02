use regex::Regex;

fn dim(input: &str) -> String {
    // Placeholder function for "dim" styling
    format!("\x1b[2m{}\x1b[0m", input)
}

pub fn usage() -> String {
    #[cfg(target_os = "macos")]
    let open = "open";
    #[cfg(windows)]
    let open = "foo";
    #[cfg(target_os = "linux")]
    let open = "xdg-open";

    let usage = r##"
usage:
  pkgx [+pkg@x.y…] <program|path> [--] [arg…]

examples:
  $ pkgx gum format "# hello world" "sup?"
  $ pkgx node@18 --eval 'console.log("hello world")'
  $ pkgx +openssl cargo build

modes:
  $ pkgx --query bun  # could you run `bun`? (-Q)
  $ pkgx --help       # hi mom!
  $ pkgx --version

flags:
  -q,  --quiet    # suppress brief informational messages
  -qq, --silent   # no chat. no errors. just execute.
  -v              # print version and continue
  --sync          # sync first (note: rarely if ever needed)
  -j,--json=v2    # output JSON (if sensible)

more:
  $ OPEN https://docs.pkgx.sh
"##;

    let usage = usage
        .replace('[', &dim("["))
        .replace(']', &dim("]"))
        .replace('<', &dim("<"))
        .replace('>', &dim(">"))
        .replace('$', &dim("$"))
        .replace('|', &dim("|"))
        .replace("OPEN", open);

    let re = Regex::new("(?m) #.*$").unwrap();

    re.replace_all(&usage, |caps: &regex::Captures| {
        dim(caps.get(0).unwrap().as_str())
    })
    .trim()
    .to_string()
}
