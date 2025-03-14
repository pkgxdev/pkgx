use std::error::Error;

use libpkgx::pantry_db;
use rusqlite::Connection;

pub fn query(args: &Vec<String>, conn: &Connection) -> Result<(), Box<dyn Error>> {
    for arg in args {
        let rv = pantry_db::which(arg, conn)?;
        if rv.is_empty() {
            std::process::exit(1);
        }
    }
    Ok(())
}
