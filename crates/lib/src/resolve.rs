use crate::config::Config;
use crate::types::{Installation, Package, PackageReq};
use crate::{cellar, inventory};
use std::error::Error;

#[derive(Debug, Default)]
pub struct Resolution {
    /// fully resolved list (includes both installed and pending)
    pub pkgs: Vec<Package>,

    /// already installed packages
    pub installed: Vec<Installation>,

    /// these are the pkgs that aren’t yet installed
    pub pending: Vec<Package>,
}

//TODO no need to take array since it doesn’t consider anything
use futures::stream::{FuturesUnordered, StreamExt};

pub async fn resolve(reqs: Vec<PackageReq>, config: &Config) -> Result<Resolution, Box<dyn Error>> {
    let mut rv = Resolution::default();

    // Create a FuturesUnordered to run the tasks concurrently
    let mut futures = FuturesUnordered::new();

    for req in reqs {
        futures.push(async move {
            if let Some(installation) = cellar::has(&req, config).await {
                Ok::<_, Box<dyn Error>>((
                    Some((installation.clone(), installation.pkg.clone())),
                    None,
                ))
            } else if let Ok(Some(version)) = inventory::select(&req, config).await {
                let pkg = Package {
                    project: req.project.clone(),
                    version,
                };
                Ok::<_, Box<dyn Error>>((None, Some(pkg)))
            } else {
                Err(Box::new(ResolveError { pkg: req }) as Box<dyn Error>)
            }
        });
    }

    // Process the results as they are completed
    while let Some(result) = futures.next().await {
        match result? {
            (Some((installation, pkg)), None) => {
                rv.installed.push(installation);
                rv.pkgs.push(pkg);
            }
            (None, Some(pkg)) => {
                rv.pkgs.push(pkg.clone());
                rv.pending.push(pkg);
            }
            _ => unreachable!(), // This should not happen
        }
    }

    Ok(rv)
}

use std::fmt;

#[derive(Debug)]
pub struct ResolveError {
    pub pkg: PackageReq, // Holds the package or requirement
}
impl Error for ResolveError {}

impl fmt::Display for ResolveError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "not-found: pkg: {:?}", self.pkg)
    }
}
