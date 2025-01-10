use std::env;
use std::io;
use std::path::PathBuf;

#[derive(Debug)]
pub struct Config {
    pub pantry_dir: PathBuf,
    pub dist_url: String,
    pub pkgx_dir: PathBuf,
}

impl Config {
    pub fn new() -> io::Result<Self> {
        let pantry_dir = get_pantry_dir()?;
        let dist_url = get_dist_url();
        let pkgx_dir = get_pkgx_dir()?;
        Ok(Self {
            pantry_dir,
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

fn get_pantry_dir() -> io::Result<PathBuf> {
    if let Ok(env_dir) = env::var("PKGX_PANTRY_DIR") {
        let path = PathBuf::from(env_dir);
        if !path.is_absolute() {
            return Ok(env::current_dir()?.join(path));
        } else {
            return Ok(path);
        }
    }
    Ok(dirs_next::cache_dir().unwrap().join("pkgx/pantry"))
}

fn get_pkgx_dir() -> io::Result<PathBuf> {
    if let Ok(env_dir) = env::var("PKGX_DIR") {
        let path = PathBuf::from(env_dir);
        if !path.is_absolute() {
            return Ok(env::current_dir()?.join(path));
        } else {
            return Ok(path);
        }
    }
    #[cfg(target_os = "macos")]
    return Ok(dirs_next::home_dir().unwrap().join(".pkgx"));
    #[cfg(target_os = "linux")]
    return Ok(dirs_next::home_dir().unwrap().join(".pkgx"));
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    panic!("Unsupported platform")
}
