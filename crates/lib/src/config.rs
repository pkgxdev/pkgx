use std::env;
use std::io;
use std::path::PathBuf;

#[derive(Debug)]
pub struct Config {
    pub pantry_dir: PathBuf,
    pub pantry_db_file: PathBuf,
    pub dist_url: String,
    pub pkgx_dir: PathBuf,
}

impl Config {
    pub fn new() -> io::Result<Self> {
        let pantry_dir = get_pantry_dir()?;
        let pantry_db_file: PathBuf = get_pantry_db_file()?;
        let dist_url = get_dist_url();
        let pkgx_dir = get_pkgx_dir()?;
        Ok(Self {
            pantry_dir,
            pantry_db_file,
            dist_url,
            pkgx_dir,
        })
    }
}

fn get_dist_url() -> String {
    if let Ok(env_url) = env::var("PKGX_DIST_URL") {
        return env_url;
    }
    env!("PKGX_DIST_URL").to_string()
}

#[allow(non_snake_case)]
fn get_PKGX_PANTRY_DIR() -> Option<PathBuf> {
    if let Ok(env_dir) = env::var("PKGX_PANTRY_DIR") {
        let path = PathBuf::from(env_dir);
        if path.is_absolute() {
            Some(path)
        } else if let Ok(cwd) = env::current_dir() {
            Some(cwd.join(path))
        } else {
            None
        }
    } else {
        None
    }
}

fn get_pantry_dir() -> io::Result<PathBuf> {
    if let Some(path) = get_PKGX_PANTRY_DIR() {
        Ok(path)
    } else if let Some(path) = dirs_next::data_local_dir() {
        Ok(path.join("pkgx/pantry"))
    } else {
        Err(io::Error::new(
            io::ErrorKind::NotFound,
            "Could not determine cache directory",
        ))
    }
}

fn get_pkgx_dir() -> io::Result<PathBuf> {
    if let Ok(path) = env::var("PKGX_DIR") {
        let path = PathBuf::from(path);
        if path.is_absolute() {
            return Ok(path);
        }
    }

    let default = dirs_next::home_dir().map(|x| x.join(".pkgx"));

    if default.clone().is_some_and(|x| x.exists()) {
        Ok(default.unwrap())
    } else if let Ok(xdg) = env::var("XDG_DATA_HOME") {
        Ok(PathBuf::from(xdg).join("pkgx"))
    } else {
        Ok(default.unwrap())
    }
}

fn get_pantry_db_file() -> io::Result<PathBuf> {
    if let Some(path) = get_PKGX_PANTRY_DIR() {
        Ok(path.join("pantry.2.db"))
    } else if let Some(path) = dirs_next::cache_dir() {
        Ok(path.join("pkgx/pantry.2.db"))
    } else {
        Err(io::Error::new(
            io::ErrorKind::NotFound,
            "Could not determine data directory",
        ))
    }
}
