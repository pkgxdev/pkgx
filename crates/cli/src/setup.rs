use std::time::Duration;

use indicatif::ProgressBar;
use libpkgx::{config::Config, sync};
use rusqlite::Connection;

use crate::args::Flags;

pub async fn setup(
    flags: &Flags,
) -> Result<(Connection, bool, Config, Option<ProgressBar>), Box<dyn std::error::Error>> {
    let config = Config::new()?;

    std::fs::create_dir_all(config.pantry_db_file.parent().unwrap())?;
    let mut conn = Connection::open(&config.pantry_db_file)?;

    let spinner = if flags.silent || flags.quiet {
        None
    } else {
        let spinner = indicatif::ProgressBar::new_spinner();
        spinner.enable_steady_tick(Duration::from_millis(100));
        Some(spinner)
    };

    let did_sync = if flags.sync || sync::should(&config)? {
        if let Some(spinner) = &spinner {
            spinner.set_message("syncing pkg-db…");
        }
        sync::ensure(&config, &mut conn).await?;
        true
    } else {
        false
    };

    Ok((conn, did_sync, config, spinner))
}
