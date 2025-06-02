use crate::{client::build_client, config::Config, pantry_db};
use async_compression::tokio::bufread::XzDecoder;
use fs2::FileExt;
use futures::TryStreamExt;
use rusqlite::Connection;
use std::{error::Error, fs::OpenOptions, path::PathBuf};
use tokio_tar::Archive;
use tokio_util::compat::FuturesAsyncReadCompatExt;

#[allow(clippy::all)]
pub fn should(config: &Config) -> Result<bool, Box<dyn Error>> {
    if !config.pantry_dir.join("projects").is_dir() {
        Ok(true)
    } else {
        // the file always exists because we create the connection
        // but will be 0 bytes if we need to fill it
        Ok(std::fs::metadata(&config.pantry_db_file)?.len() == 0)
    }
}

// doesn’t replace pantry clone, will build db
// essential for working in a local pantry clone with PKGX_PANTRY_DIR set
pub async fn ensure(config: &Config, conn: &mut Connection) -> Result<(), Box<dyn Error>> {
    if !config.pantry_dir.join("projects").is_dir() {
        replace(config, conn).await
    } else {
        let lockfile = lock(config)?;
        pantry_db::cache(config, conn)?;
        FileExt::unlock(&lockfile)?;
        Ok(())
    }
}

pub async fn update(config: &Config, conn: &mut Connection) -> Result<(), Box<dyn Error>> {
    if std::env::var("PKGX_PANTRY_DIR").is_ok() {
        return Err("PKGX_PANTRY_DIR is set, refusing to update pantry")?;
    }
    replace(config, conn).await
}

async fn replace(config: &Config, conn: &mut Connection) -> Result<(), Box<dyn Error>> {
    let url = format!(
        "{}/{}",
        config.dist_url,
        env!("PKGX_PANTRY_TARBALL_FILENAME")
    );

    let lockfile = lock(config)?;
    download_and_extract_pantry(&url, &config.pantry_dir).await?;
    pantry_db::cache(config, conn)?;
    FileExt::unlock(&lockfile)?;

    Ok(())
}

async fn download_and_extract_pantry(url: &str, dest: &PathBuf) -> Result<(), Box<dyn Error>> {
    let rsp = build_client()?.get(url).send().await?.error_for_status()?;

    let stream = rsp.bytes_stream();

    let stream = stream.map_err(futures::io::Error::other).into_async_read();
    let stream = stream.compat();

    let decoder = XzDecoder::new(stream);

    // Step 3: Extract the tar archive
    let mut archive = Archive::new(decoder);
    archive.unpack(dest).await?;

    Ok(())
}

fn lock(config: &Config) -> Result<std::fs::File, Box<dyn Error>> {
    std::fs::create_dir_all(&config.pantry_dir)?;
    #[cfg(not(windows))]
    let lockfile = OpenOptions::new().read(true).open(&config.pantry_dir)?;
    #[cfg(windows)]
    let lockfile = OpenOptions::new()
        .read(true)
        .create(true)
        .truncate(true)
        .write(true)
        .open(config.pantry_dir.join("lockfile"))?;
    lockfile.lock_exclusive()?;
    Ok(lockfile)
}
