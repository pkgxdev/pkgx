use crate::config::Config;
use crate::types::{Installation, Package, PackageReq};
use libsemverator::semver::Semver as Version;
use std::error::Error;
use std::path::PathBuf;
use tokio::fs;

pub async fn ls(project: &str, config: &Config) -> Result<Vec<Installation>, Box<dyn Error>> {
    let d = config.pkgx_dir.join(project);

    if !fs::metadata(&d).await?.is_dir() {
        return Ok(vec![]);
    }

    let mut rv = vec![];
    let mut entries = fs::read_dir(&d).await?;
    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if !name.starts_with('v') || name == "var" {
            continue;
        }
        if !fs::symlink_metadata(&path).await?.is_dir() {
            continue;
        }

        if let Ok(version) = Version::parse(&name[1..]) {
            rv.push(Installation {
                path,
                pkg: Package {
                    project: project.to_string(),
                    version,
                },
            });
        }
    }

    Ok(rv)
}

pub async fn resolve(pkgreq: &PackageReq, config: &Config) -> Result<Installation, Box<dyn Error>> {
    let installations = ls(&pkgreq.project, config).await?;

    if let Some(i) = installations
        .iter()
        .filter(|i| pkgreq.constraint.satisfies(&i.pkg.version))
        .max_by_key(|i| i.pkg.version.clone())
    {
        Ok(i.clone())
    } else {
        // If no matching version is found, return an error
        Err(format!("couldn’t resolve {:?}", pkgreq).into())
    }
}

pub async fn has(pkg: &PackageReq, config: &Config) -> Option<Installation> {
    resolve(pkg, config).await.ok()
}

pub fn dst(pkg: &Package, config: &Config) -> PathBuf {
    config
        .pkgx_dir
        .join(pkg.project.clone())
        .join(format!("v{}", pkg.version.raw))
}
