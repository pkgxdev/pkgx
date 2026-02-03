use console::style;

#[derive(PartialEq)]
pub enum Mode {
    X,
    Help,
    Version,
    Query,
}

pub struct Flags {
    pub quiet: bool,
    pub silent: bool,
    pub json: Option<isize>,
    pub version_n_continue: bool,
    pub shebang: bool,
    pub sync: bool,
    pub chdir: Option<String>,
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
    let mut json = None;
    let mut find_program = false;
    let mut collecting_args = false;
    let mut version_n_continue = false;
    let mut shebang = false;
    let mut sync = false;
    let mut chdir = None;
    let json_latest_v: isize = 2;

    let mut args_iter = std::env::args().skip(1);
    while let Some(arg) = args_iter.next() {
        if collecting_args {
            args.push(arg);
        } else if arg.starts_with('+') {
            plus.push(arg.trim_start_matches('+').to_string());
        } else if arg == "--" {
            find_program = false;
            collecting_args = true;
        } else if arg.starts_with("--") {
            match arg.as_str() {
                "--shebang" => shebang = true,
                "--json" => {
                    if !silent {
                        eprintln!(
                            "{} use --json=v{}",
                            style("warning: --json is not stable").yellow(),
                            json_latest_v
                        );
                    }
                    json = Some(2);
                }
                "--chdir" | "--cd" => chdir = args_iter.next(),
                "--json=v1" => json = Some(1),
                "--json=v2" => json = Some(2),
                "--silent" => silent = true,
                "--help" => mode = Mode::Help,
                "--version" => mode = Mode::Version,
                "--quiet" => quiet = true,
                "--query" => mode = Mode::Query,
                "--sync" => sync = true,
                "--shellcode" => {
                    if !silent {
                        eprintln!("{}", style("⨯ migration required").red());
                        eprintln!(
                            "{} pkgx^2 is now exclusively focused on executing packages",
                            style("│").red()
                        );
                        eprintln!(
                            "{} you need to migrate to the new, independent `dev` command",
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
                    'j' => json = Some(json_latest_v),
                    'v' => version_n_continue = true,
                    '!' => shebang = true,
                    'Q' => mode = Mode::Query,
                    'C' => chdir = args_iter.next(),
                    _ => panic!("unknown argument: -{}", c),
                }
            }
        } else {
            if mode != Mode::Query {
                find_program = !arg.contains('/');
                collecting_args = true;
            }
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
            sync,
            chdir,
        },
    }
}
