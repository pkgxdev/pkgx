#[cfg(not(windows))]
use std::os::unix::fs::PermissionsExt;
use std::{error::Error, path::Path};

pub async fn find_program(arg: &str, paths: &Vec<String>) -> Result<String, Box<dyn Error>> {
    if Path::new(arg).is_absolute() {
        return Ok(arg.to_string());
    } else if arg.contains("/") {
        return Ok(std::env::current_dir()
            .unwrap()
            .join(arg)
            .to_str()
            .unwrap()
            .to_string());
    }
    for path in paths {
        #[cfg(unix)]
        let full_path = Path::new(&path).join(arg);
        #[cfg(unix)]
        if full_path.is_file() {
            if let Ok(metadata) = full_path.metadata() {
                if metadata.permissions().mode() & 0o111 != 0 {
                    return Ok(full_path.to_str().unwrap().to_string());
                }
            }
        }
        #[cfg(windows)]
        for ext in ["exe", "bat", "cmd"].iter() {
            let full_path = Path::new(&path).join(format!("{}.{}", arg, ext));
            if full_path.is_file() {
                return Ok(full_path.to_str().unwrap().to_string());
            }
        }
    }
    Err(format!("cmd not found: {}", arg).into())
}
