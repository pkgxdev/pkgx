mod cellar;
mod client;
pub mod config;
pub mod env;
pub mod hydrate;
mod install;
pub mod install_multi;
pub mod inventory;
mod pantry;
pub mod pantry_db;
pub mod platform_case_aware_env_key;
pub mod resolve;
pub mod sync;
pub mod types;
pub mod utils;

pub type Version = libsemverator::semver::Semver;
pub type VersionRange = libsemverator::range::Range;
