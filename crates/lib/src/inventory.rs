use crate::client::build_client;
use crate::config::Config;
use crate::types::{host, Package, PackageReq};
use libsemverator::semver::Semver as Version;
use reqwest::Url;
use std::error::Error;

// Select function to pick a version
pub async fn select(rq: &PackageReq, config: &Config) -> Result<Option<Version>, Box<dyn Error>> {
    let versions = ls(&rq.project, config).await?;

    Ok(versions
        .iter()
        .filter(|v| rq.constraint.satisfies(v))
        .max()
        .cloned())
}

// Get function to fetch available versions
pub async fn ls(project: &String, config: &Config) -> Result<Vec<Version>, Box<dyn Error>> {
    let base_url = config.dist_url.clone();

    let (platform, arch) = host();
    let url = Url::parse(&format!(
        "{}/{}/{}/{}/versions.txt",
        base_url, project, platform, arch
    ))?;

    let rsp = build_client()?
        .get(url.clone())
        .send()
        .await?
        .error_for_status()?;

    let releases = rsp.text().await?;
    let mut versions: Vec<Version> = releases
        .lines()
        .map(Version::parse)
        .filter_map(Result::ok)
        .collect();

    if versions.is_empty() {
        return Err(Box::new(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("No inventory for {}", project),
        )));
    }

    if project == "openssl.org" {
        // Workaround: Remove specific version
        let excluded_version = Version::parse("1.1.118")?;
        versions.retain(|x| x != &excluded_version);
    }

    Ok(versions)
}

//TODO xz bottles are preferred
pub fn get_url(pkg: &Package, config: &Config) -> String {
    let (platform, arch) = host();
    format!(
        "{}/{}/{}/{}/v{}.tar.xz",
        config.dist_url, pkg.project, platform, arch, pkg.version.raw
    )
}
