use std::error::Error;

use libpkgx::pantry_db;
use rusqlite::Connection;

pub fn query(args: &Vec<String>, silent: bool, conn: &Connection) -> Result<(), Box<dyn Error>> {
    let mut fail = false;
    for arg in args {
        let projects = pantry_db::which(arg, conn)?;
        if projects.is_empty() && silent {
            std::process::exit(1);
        } else if projects.is_empty() {
            println!("{} not found", arg);
            fail = true;
        } else if !silent {
            println!("{}", projects.join(", "));
        }
    }
    if fail {
        std::process::exit(1);
    }
    Ok(())
}
