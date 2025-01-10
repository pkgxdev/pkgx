use std::error::Error;
use std::sync::Arc;

use crate::install::{install, InstallEvent};
use crate::types::{Installation, Package};
use futures::stream::FuturesUnordered;
use futures::StreamExt;

use crate::config::Config;

pub trait ProgressBarExt {
    fn inc(&self, n: u64);
    fn inc_length(&self, n: u64);
}

pub async fn install_multi(
    pending: &[Package],
    config: &Config,
    pb: Option<Arc<impl ProgressBarExt + Send + Sync + 'static>>,
) -> Result<Vec<Installation>, Box<dyn Error>> {
    pending
        .iter()
        .map(|pkg| {
            install(
                pkg,
                config,
                pb.clone().map(|pb| {
                    move |event| match event {
                        InstallEvent::DownloadSize(size) => {
                            pb.inc_length(size);
                        }
                        InstallEvent::Progress(chunk) => {
                            pb.inc(chunk);
                        }
                    }
                }),
            )
        })
        .collect::<FuturesUnordered<_>>()
        .collect::<Vec<_>>()
        .await
        .into_iter()
        .collect()
}
