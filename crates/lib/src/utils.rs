#[cfg(not(windows))]
use std::os::unix::fs::PermissionsExt;
use std::{error::Error, path::Path};

pub async fn find_program(arg: &str, paths: &Vec<String>) -> Result<String, Box<dyn Error>> {
    if arg.starts_with("/") {
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
        let full_path = Path::new(&path).join(arg);
        if full_path.is_file() {
            #[cfg(unix)]
            if let Ok(metadata) = full_path.metadata() {
                if metadata.permissions().mode() & 0o111 != 0 {
                    return Ok(full_path.to_str().unwrap().to_string());
                }
            }
            #[cfg(windows)]
            if let Some(ext) = full_path.extension() {
                match ext.to_str() {
                    Some("exe") | Some("bat") | Some("cmd") => {
                        return Ok(full_path.to_str().unwrap().to_string())
                    }
                    _ => {}
                }
            }
        }
    }
    Err(format!("cmd not found: {}", arg).into())
}
