use crate::{config::Config, pantry_db};
use async_compression::tokio::bufread::GzipDecoder;
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
        let dest = &config.pantry_dir;
        std::fs::create_dir_all(dest.clone())?;
        let dir = OpenOptions::new()
            .read(true) // Open in read-only mode; no need to write.
            .open(dest)?;
        dir.lock_exclusive()?;

        pantry_db::cache(config, conn)?;

        FileExt::unlock(&dir)?;

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
    let url = env!("PKGX_PANTRY_TARBALL_URL");
    let dest = &config.pantry_dir;

    std::fs::create_dir_all(dest)?;
    let dir = OpenOptions::new()
        .read(true) // Open in read-only mode; no need to write.
        .open(dest)?;
    dir.lock_exclusive()?;

    download_and_extract_pantry(url, dest).await?;

    pantry_db::cache(config, conn)?;

    FileExt::unlock(&dir)?;

    Ok(())
}

async fn download_and_extract_pantry(url: &str, dest: &PathBuf) -> Result<(), Box<dyn Error>> {
    let rsp = reqwest::get(url).await?.error_for_status()?;

    let stream = rsp.bytes_stream();

    let stream = stream
        .map_err(|e| futures::io::Error::new(futures::io::ErrorKind::Other, e))
        .into_async_read();
    let stream = stream.compat();

    let decoder = GzipDecoder::new(stream);

    // Step 3: Extract the tar archive
    let mut archive = Archive::new(decoder);
    archive.unpack(dest).await?;

    Ok(())
}
