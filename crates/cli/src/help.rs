use regex::Regex;

fn dim(input: &str) -> String {
    // Placeholder function for "dim" styling
    format!("\x1b[2m{}\x1b[0m", input)
}

pub fn usage() -> String {
    let usage = r##"
usage:
  pkgx [+pkg@x.y…] <program|path> [--] [arg…]

examples:
  $ pkgx gum format "# hello world" "sup?"
  $ pkgx node@18 --eval 'console.log("hello world")'
  $ pkgx +openssl cargo build

flags:
  -q,  --quiet    # suppress brief informational messages
  -qq, --silent   # no chat. no errors. just execute.
  -!,  --shebang  # drops shebang added arg0 for faster pkgx stubs
  -v,  --version

more:
  $ open https://docs.pkgx.sh
"##;

    let usage = usage
        .replace('[', &dim("["))
        .replace(']', &dim("]"))
        .replace('<', &dim("<"))
        .replace('>', &dim(">"))
        .replace('$', &dim("$"))
        .replace('|', &dim("|"));

    let re = Regex::new("(?m) #.*$").unwrap();

    re.replace_all(&usage, |caps: &regex::Captures| {
        dim(caps.get(0).unwrap().as_str())
    })
    .trim()
    .to_string()
}
