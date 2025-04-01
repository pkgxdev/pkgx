use std::{sync::Arc, time::Duration};

use libpkgx::install_multi::ProgressBarExt;

pub struct Spinner {
    quiet: bool,
    silent: bool,
    bar: Option<indicatif::ProgressBar>,
}

impl Spinner {
    pub fn new(quiet: bool, silent: bool) -> Spinner {
        Self {
            bar: None,
            quiet,
            silent,
        }
    }

    pub fn set_message(&mut self, msg: &str) {
        if self.silent || self.quiet {
            return;
        }
        if let Some(bar) = &self.bar {
            bar.set_message(msg.to_string());
        } else {
            let bar = indicatif::ProgressBar::new_spinner();
            bar.set_message(msg.to_string());
            bar.enable_steady_tick(Duration::from_millis(100));
            self.bar = Some(bar);
        }
    }

    pub fn finish_and_clear(&self) {
        if let Some(bar) = &self.bar {
            bar.finish_and_clear();
        }
    }

    pub fn arc(&self) -> Option<Arc<impl ProgressBarExt + Send + Sync + 'static>> {
        if let Some(bar) = &self.bar {
            configure_bar(bar);
            Some(Arc::new(MultiProgressBar { pb: bar.clone() }))
        } else {
            None
        }
    }
}

use indicatif::{ProgressBar, ProgressState, ProgressStyle};
use std::fmt::Write;

struct MultiProgressBar {
    pb: ProgressBar,
}

impl libpkgx::install_multi::ProgressBarExt for MultiProgressBar {
    fn inc(&self, n: u64) {
        self.pb.inc(n);
    }

    fn inc_length(&self, n: u64) {
        self.pb.inc_length(n);
    }
}

// ProgressBar is Send + Sync
unsafe impl Send for MultiProgressBar {}
unsafe impl Sync for MultiProgressBar {}

fn configure_bar(pb: &ProgressBar) {
    pb.set_length(1);
    pb.set_style(
        ProgressStyle::with_template(
            "{elapsed:.dim} ❲{wide_bar:.red}❳ {percent}% {bytes_per_sec:.dim} {bytes:.dim}",
        )
        .unwrap()
        .with_key("elapsed", |state: &ProgressState, w: &mut dyn Write| {
            let s = state.elapsed().as_secs_f64();
            let precision = precision(s);
            write!(w, "{:.precision$}s", s, precision = precision).unwrap()
        })
        .with_key("bytes", |state: &ProgressState, w: &mut dyn Write| {
            let (right, divisor) = pretty_size(state.len().unwrap());
            let left = state.pos() as f64 / divisor as f64;
            let leftprecision = precision(left);
            write!(
                w,
                "{:.precision$}/{}",
                left,
                right,
                precision = leftprecision
            )
            .unwrap()
        })
        .progress_chars("⚯ "),
    );
    pb.enable_steady_tick(Duration::from_millis(50));
}

// pub(crate) for tests (FIXME)
pub(crate) fn pretty_size(n: u64) -> (String, u64) {
    let units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];

    // number of 1024s
    let thousands = n.max(1).ilog(1024).clamp(0, units.len() as u32 - 1) as usize;
    // size in the appropriate unit
    let size = n as f64 / 1024.0f64.powi(thousands as i32);
    // the divisor to get back to bytes
    let divisor = 1024u64.pow(thousands as u32);
    // number of decimal places to show (0 if we're bytes. no fractional bytes. come on.)
    let precision = if thousands == 0 { 0 } else { precision(size) };

    let formatted = format!(
        "{:.precision$} {}",
        size,
        units[thousands],
        precision = precision
    );

    (formatted, divisor)
}

// pub(crate) for tests (FIXME)
pub(crate) fn precision(n: f64) -> usize {
    // 1 > 1.00, 10 > 10.0, 100 > 100
    2 - (n.log10().clamp(0.0, 2.0) as usize)
}
