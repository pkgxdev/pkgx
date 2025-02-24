#[cfg(target_os = "macos")]
use std::fs;

#[cfg(target_os = "macos")]
pub fn good_on_macos(cmd: &str) -> bool {
    //TODO there’s a lot more in there
    //NOTE tricky to know how to keep this updated or varied by CLT version etc.
    //THO  probs the tools we care about don’t vary or change
    match cmd {
        "/usr/bin/cc" => has_xcode_clt(),
        "/usr/bin/c++" => has_xcode_clt(),
        "/usr/bin/make" => has_xcode_clt(),
        "/usr/bin/python3" => has_xcode_clt(),
        "/usr/bin/pip3" => has_xcode_clt(),
        "/usr/bin/strip" => has_xcode_clt(),
        "/usr/bin/git" => has_xcode_clt(),
        _ => true,
    }
}

#[cfg(target_os = "macos")]
fn has_xcode_clt() -> bool {
    fs::metadata("/Library/Developer/CommandLineTools/usr/bin")
        .map(|m| m.is_dir())
        .unwrap_or(false)
}
