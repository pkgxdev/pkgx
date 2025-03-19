#[cfg(windows)]
use std::{
    fmt,
    hash::{Hash, Hasher},
};

#[cfg(windows)]
#[derive(Clone)]
pub struct CaseInsensitiveKey(pub String);

#[cfg(windows)]
impl PartialEq for CaseInsensitiveKey {
    fn eq(&self, other: &Self) -> bool {
        self.0.eq_ignore_ascii_case(&other.0)
    }
}

#[cfg(windows)]
impl fmt::Display for CaseInsensitiveKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[cfg(windows)]
impl Eq for CaseInsensitiveKey {}

#[cfg(windows)]
impl Hash for CaseInsensitiveKey {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.0.to_lowercase().hash(state);
    }
}

#[cfg(windows)]
impl fmt::Debug for CaseInsensitiveKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}", self.0)
    }
}

#[cfg(windows)]
pub type PlatformCaseAwareEnvKey = CaseInsensitiveKey;
#[cfg(not(windows))]
pub type PlatformCaseAwareEnvKey = String;

#[cfg(windows)]
pub fn construct_platform_case_aware_env_key(key: String) -> PlatformCaseAwareEnvKey {
    CaseInsensitiveKey(key)
}

#[cfg(not(windows))]
pub fn construct_platform_case_aware_env_key(key: String) -> PlatformCaseAwareEnvKey {
    key
}
