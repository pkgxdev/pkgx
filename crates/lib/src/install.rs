use async_compression::tokio::bufread::XzDecoder;
use fs2::FileExt;
use std::{
    error::Error,
    fs::{self, OpenOptions},
};
use tempfile::tempdir_in;
use tokio::task;
use tokio_tar::Archive;

// Compatibility trait lets us call `compat()` on a futures::io::AsyncRead
// to convert it into a tokio::io::AsyncRead.
use tokio_util::compat::FuturesAsyncReadCompatExt;

// Lets us call into_async_read() to convert a futures::stream::Stream into a
// futures::io::AsyncRead.
use futures::stream::TryStreamExt;

use crate::{
    cellar,
    client::build_client,
    config::Config,
    inventory,
    types::{Installation, Package},
};

pub enum InstallEvent {
    DownloadSize(u64), // Total size of the download in bytes
    Progress(u64),     // we downloaded n bytes
}

//TODO set UserAgent

pub async fn install<F>(
    pkg: &Package,
    config: &Config,
    mut event_callback: Option<F>,
) -> Result<Installation, Box<dyn Error>>
where
    F: FnMut(InstallEvent) + Send + 'static,
{
    let shelf = config.pkgx_dir.join(&pkg.project);
    fs::create_dir_all(&shelf)?;

    #[cfg(windows)]
    let lockfile = OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(true)
        .open(shelf.join("lockfile"))?;
    #[cfg(not(windows))]
    let lockfile = OpenOptions::new()
        .read(true) // Open the directory in read-only mode
        .open(shelf.clone())?;

    task::spawn_blocking({
        let lockfile = lockfile.try_clone()?;
        move || {
            lockfile
                .lock_exclusive()
                .expect("unexpected error: install locking failed");
        }
    })
    .await?;

    let dst_path = cellar::dst(pkg, config);

    // did another instance of pkgx install us while we waited for the lock?
    // if so, we’re good: eject
    if dst_path.is_dir() {
        FileExt::unlock(&lockfile)?;
        return Ok(Installation {
            path: dst_path,
            pkg: pkg.clone(),
        });
    }

    let url = inventory::get_url(pkg, config);
    let client = build_client()?;
    let rsp = client.get(url).send().await?.error_for_status()?;

    let total_size = rsp
        .content_length()
        .ok_or("Failed to get content length from response")?;

    if let Some(cb) = event_callback.as_mut() {
        cb(InstallEvent::DownloadSize(total_size));
    }

    let stream = rsp.bytes_stream();

    //TODO we don’t want to add inspect_ok to the stream at all in --silent mode
    //  ^^ but the borrow checker despises us with a venom I can barely articulate if we try
    let stream = stream.inspect_ok(move |chunk| {
        if let Some(cb) = event_callback.as_mut() {
            cb(InstallEvent::Progress(chunk.len() as u64));
        }
    });

    let stream = stream
        .map_err(|e| futures::io::Error::new(futures::io::ErrorKind::Other, e))
        .into_async_read();
    let stream = stream.compat();

    // Step 2: Create a XZ decoder
    let decoder = XzDecoder::new(stream);

    // Step 3: Make a temporary directory to extract the tarball into
    let temp_dir = tempdir_in(config.pkgx_dir.join(&pkg.project))?;

    // Step 4: Extract the tar archive
    let mut archive = Archive::new(decoder);
    archive.unpack(&temp_dir).await?;

    // Step 5: atomically move from temp dir to installation location
    let partial_path = format!("{}/v{}", pkg.project, pkg.version.raw);
    fs::rename(temp_dir.path().join(&partial_path), &dst_path)?;

    let installation = Installation {
        path: dst_path,
        pkg: pkg.clone(),
    };

    #[cfg(not(windows))]
    symlink(&installation, config).await?;
    // ^^ you need admin privs to symlink on windows (wtf)

    FileExt::unlock(&lockfile)?;

    Ok(installation)
}

#[cfg(not(windows))]
use {
    libsemverator::range::Range as VersionReq, libsemverator::semver::Semver as Version,
    std::collections::VecDeque, std::path::Path, std::path::PathBuf,
};

#[cfg(not(windows))]
async fn symlink(installation: &Installation, config: &Config) -> Result<(), Box<dyn Error>> {
    let mut versions: VecDeque<(Version, PathBuf)> = cellar::ls(&installation.pkg.project, config)
        .await?
        .into_iter()
        .map(|entry| (entry.pkg.version, entry.path))
        .collect();

    versions.make_contiguous().sort_by(|a, b| a.0.cmp(&b.0));

    if versions.is_empty() {
        return Err(format!("no versions for package {}", installation.pkg.project).into());
    }

    let shelf = installation.path.parent().unwrap();
    let newest = versions.back().unwrap(); // Safe as we've checked it's not empty

    let v_mm = format!(
        "{}.{}",
        installation.pkg.version.major, installation.pkg.version.minor
    );
    let minor_range = if installation.pkg.version.major > 0 {
        VersionReq::caret(&v_mm)?
    } else {
        VersionReq::parse(&format!(
            ">={},<0.{}",
            v_mm,
            installation.pkg.version.minor + 1
        ))?
    };
    let most_minor = versions
        .iter()
        .filter(|(version, _)| minor_range.satisfies(version))
        .next_back()
        .ok_or_else(|| {
            anyhow::anyhow!(
                "Could not find most minor version for {}",
                installation.pkg.project
            )
        })?;

    if most_minor.0 != installation.pkg.version {
        return Ok(());
    }

    make_symlink(shelf, &format!("v{}", v_mm), installation).await?;

    // bug in semverator
    let major_range = VersionReq::parse(&format!("^{}", installation.pkg.version.major))?;

    let most_major = versions
        .iter()
        .filter(|(version, _)| major_range.satisfies(version))
        .next_back()
        .ok_or_else(|| anyhow::anyhow!("Could not find most major version"))?;

    if most_major.0 != installation.pkg.version {
        return Ok(());
    }

    make_symlink(
        shelf,
        &format!("v{}", installation.pkg.version.major),
        installation,
    )
    .await?;

    if installation.pkg.version == newest.0 {
        make_symlink(shelf, "v*", installation).await?;
    }

    Ok(())
}

#[cfg(not(windows))]
async fn make_symlink(
    shelf: &Path,
    symname: &str,
    installation: &Installation,
) -> Result<(), Box<dyn Error>> {
    let symlink_path = shelf.join(symname);

    if symlink_path.is_symlink() {
        if let Err(err) = fs::remove_file(&symlink_path) {
            if err.kind() != std::io::ErrorKind::NotFound {
                return Err(err.into());
            }
        }
    }

    let target = installation
        .path
        .file_name()
        .ok_or_else(|| anyhow::anyhow!("Could not get the base name of the installation path"))?;

    #[cfg(not(windows))]
    std::os::unix::fs::symlink(target, &symlink_path)?;
    #[cfg(windows)]
    std::os::windows::fs::symlink_dir(target, symlink_path)?;

    Ok(())
}
