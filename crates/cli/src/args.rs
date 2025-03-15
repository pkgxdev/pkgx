use console::style;

pub enum Mode {
    X,
    Help,
    Version,
    Query,
}

pub struct Flags {
    pub quiet: bool,
    pub silent: bool,
    pub json: bool,
    pub version_n_continue: bool,
    pub shebang: bool,
}

pub struct Args {
    pub plus: Vec<String>,
    pub args: Vec<String>,
    pub find_program: bool,
    pub mode: Mode,
    pub flags: Flags,
}

pub fn parse() -> Args {
    let mut mode = Mode::X;
    let mut plus = Vec::new();
    let mut args = Vec::new();
    let mut silent: bool = false;
    let mut quiet: bool = false;
    let mut json: bool = false;
    let mut find_program = false;
    let mut collecting_args = false;
    let mut version_n_continue = false;
    let mut shebang = false;

    for arg in std::env::args().skip(1) {
        if collecting_args {
            args.push(arg);
        } else if arg.starts_with('+') {
            plus.push(arg.trim_start_matches('+').to_string());
        } else if arg == "--" {
            find_program = false;
            collecting_args = true;
        } else if arg.starts_with("--") {
            match arg.as_str() {
                "--json" => {
                    if !silent {
                        eprintln!(
                            "{} use --json=v1",
                            style("warning: --json is not stable").yellow()
                        );
                    }
                    json = true
                }
                "--shebang" => shebang = true,
                "--json=v1" => json = true,
                "--silent" => silent = true,
                "--help" => mode = Mode::Help,
                "--version" => mode = Mode::Version,
                "--quiet" => quiet = true,
                "--query" => mode = Mode::Query,
                "--shellcode" => {
                    if !silent {
                        eprintln!("{}", style("⨯ migration required").red());
                        eprintln!(
                            "{} pkgx^2 is now exclusively focused on executing packages",
                            style("│").red()
                        );
                        eprintln!(
                            "{} you need to migrate to the new, isolated `dev` command",
                            style("│").red()
                        );
                        eprintln!("{} run the following:", style("│").red());
                        eprintln!(
                            "{} pkgx pkgx^1 deintegrate && pkgx dev integrate",
                            style("╰─➤").red()
                        );
                    }
                    std::process::exit(1);
                }
                _ => panic!("unknown argument {}", arg),
            }
        } else if arg.starts_with('-') {
            // spit arg into characters
            for c in arg.chars().skip(1) {
                match c {
                    'q' => {
                        if quiet {
                            silent = true
                        } else {
                            quiet = true
                        }
                    }
                    'h' => mode = Mode::Help,
                    's' => silent = true,
                    'j' => json = true,
                    'v' => version_n_continue = true,
                    '!' => shebang = true,
                    'Q' => mode = Mode::Query,
                    _ => panic!("unknown argument: -{}", c),
                }
            }
        } else {
            find_program = !arg.contains('/');
            collecting_args = true;
            args.push(arg);
        }
    }

    Args {
        plus,
        args,
        find_program,
        mode,
        flags: Flags {
            shebang,
            silent,
            json,
            quiet,
            version_n_continue,
        },
    }
}
