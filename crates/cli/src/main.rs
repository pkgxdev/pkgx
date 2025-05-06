mod args;
mod dump;
mod execve;
mod help;
mod query;
mod resolve;
mod spinner;
#[cfg(test)]
mod tests;
mod which;
mod x;

use execve::execve;
use libpkgx::{config::Config, sync};
use spinner::Spinner;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args::Args {
        plus,
        mut args,
        mode,
        flags,
        find_program,
    } = args::parse();

    if let Some(dir) = &flags.chdir {
        std::env::set_current_dir(dir)?;
    }

    if flags.version_n_continue {
        eprintln!("{}", get_version_string(flags.json.is_some()));
    }

    match mode {
        args::Mode::Help => {
            println!("{}", help::usage());
            Ok(())
        }
        args::Mode::Version => {
            println!("{}", get_version_string(flags.json.is_some()));
            Ok(())
        }
        args::Mode::Query => {
            let (conn, _, _, _) = setup(&flags).await?;
            query::query(&args, flags.silent, &conn)
        }
        args::Mode::X => {
            let (mut conn, did_sync, config, mut spinner) = setup(&flags).await?;
            let (installations, graph) = resolve::resolve(
                &mut args,
                &plus,
                find_program,
                &config,
                &mut conn,
                did_sync,
                &mut spinner,
            )
            .await?;

            if !args.is_empty() {
                let env = libpkgx::env::map(&installations);
                let (cmd, args, env) =
                    x::exec(find_program, args, installations, env, flags, conn, graph).await?;
                spinner.finish_and_clear();
                execve(cmd, args, env)?;
                Ok(())
            } else if !plus.is_empty() {
                spinner.finish_and_clear();
                dump::dump(conn, installations, &flags)?;
                Ok(())
            } else if flags.version_n_continue || flags.sync {
                Ok(())
            } else {
                spinner.finish_and_clear();
                eprintln!("{}", help::usage());
                std::process::exit(2);
            }
        }
    }
}

async fn setup(
    flags: &args::Flags,
) -> Result<(rusqlite::Connection, bool, Config, Spinner), Box<dyn std::error::Error>> {
    let config = Config::new()?;

    std::fs::create_dir_all(config.pantry_db_file.parent().unwrap())?;
    let mut conn = rusqlite::Connection::open(&config.pantry_db_file)?;

    let mut spinner = Spinner::new(flags.quiet, flags.silent);

    let did_sync = if flags.sync || sync::should(&config)? {
        spinner.set_message("syncing pkg-db…");
        sync::ensure(&config, &mut conn).await?;
        true
    } else {
        false
    };

    Ok((conn, did_sync, config, spinner))
}

fn get_version_string(json: bool) -> String {
    if !json {
        format!("pkgx {}", env!("CARGO_PKG_VERSION"))
    } else {
        format!(
            "{{\"program\": \"pkgx\", \"version\": \"{}\"}}",
            env!("CARGO_PKG_VERSION")
        )
    }
}
