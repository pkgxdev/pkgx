use std::{
    collections::{HashMap, HashSet},
    error::Error,
    path::PathBuf,
};

#[cfg(unix)]
use std::str::FromStr;

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

use crate::types::Installation;

#[cfg(unix)]
const SEP: &str = ":";
#[cfg(windows)]
const SEP: &str = ";";

pub fn map(installations: &Vec<Installation>) -> HashMap<String, Vec<String>> {
    let mut vars: HashMap<EnvKey, OrderedSet<PathBuf>> = HashMap::new();

    let projects: HashSet<&str> = installations
        .iter()
        .map(|i| i.pkg.project.as_str())
        .collect();

    for installation in installations {
        for key in EnvKey::iter() {
            if let Some(suffixes) = suffixes(&key) {
                for suffix in suffixes {
                    let path = installation.path.join(suffix);
                    if path.is_dir() {
                        vars.entry(key.clone())
                            .or_insert_with(OrderedSet::new)
                            .add(path);
                    }
                }
            }
        }

        if projects.contains("cmake.org") {
            vars.entry(EnvKey::CmakePrefixPath)
                .or_insert_with(OrderedSet::new)
                .add(installation.path.clone());
        }
    }

    // don’t break `man`
    #[cfg(unix)]
    if vars.contains_key(&EnvKey::Manpath) {
        vars.get_mut(&EnvKey::Manpath)
            .unwrap()
            .add(PathBuf::from_str("/usr/share/man").unwrap());
    }

    // https://github.com/pkgxdev/libpkgx/issues/70
    #[cfg(unix)]
    if vars.contains_key(&EnvKey::XdgDataDirs) {
        let set = vars.get_mut(&EnvKey::XdgDataDirs).unwrap();
        set.add(PathBuf::from_str("/usr/local/share").unwrap());
        set.add(PathBuf::from_str("/usr/share").unwrap());
    }

    let mut rv: HashMap<String, Vec<String>> = HashMap::new();
    for (key, set) in vars {
        let set = set
            .items
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect();
        rv.insert(key.as_ref().to_string(), set);
    }
    rv
}

use rusqlite::Connection;
use strum::IntoEnumIterator;
use strum_macros::{AsRefStr, EnumIter, EnumString};

#[derive(Debug, EnumString, AsRefStr, PartialEq, Eq, Hash, Clone, EnumIter)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
enum EnvKey {
    Path,
    Manpath,
    PkgConfigPath,
    #[cfg(unix)]
    LibraryPath,
    #[cfg(unix)]
    LdLibraryPath,
    #[cfg(unix)]
    Cpath,
    XdgDataDirs,
    CmakePrefixPath,
    #[cfg(target_os = "macos")]
    DyldFallbackLibraryPath,
    SslCertFile,
    #[cfg(unix)]
    Ldflags,
    PkgxDir,
    AclocalPath,
    #[cfg(windows)]
    Lib,
    #[cfg(windows)]
    Include,
}

struct OrderedSet<T: Eq + std::hash::Hash + Clone> {
    items: Vec<T>,
    set: HashSet<T>,
}

impl<T: Eq + std::hash::Hash + Clone> OrderedSet<T> {
    fn new() -> Self {
        OrderedSet {
            items: Vec::new(),
            set: HashSet::new(),
        }
    }

    fn add(&mut self, item: T) {
        if self.set.insert(item.clone()) {
            self.items.push(item);
        }
    }
}

fn suffixes(key: &EnvKey) -> Option<Vec<&'static str>> {
    match key {
        EnvKey::Path => Some(vec!["bin", "sbin"]),
        EnvKey::Manpath => Some(vec!["man", "share/man"]),
        EnvKey::PkgConfigPath => Some(vec!["share/pkgconfig", "lib/pkgconfig"]),
        EnvKey::XdgDataDirs => Some(vec!["share"]),
        EnvKey::AclocalPath => Some(vec!["share/aclocal"]),
        #[cfg(unix)]
        EnvKey::LibraryPath | EnvKey::LdLibraryPath => Some(vec!["lib", "lib64"]),
        #[cfg(target_os = "macos")]
        EnvKey::DyldFallbackLibraryPath => Some(vec!["lib", "lib64"]),
        #[cfg(unix)]
        EnvKey::Cpath => Some(vec!["include"]),
        EnvKey::CmakePrefixPath | EnvKey::SslCertFile | EnvKey::PkgxDir => None,
        #[cfg(unix)]
        EnvKey::Ldflags => None,
        #[cfg(windows)]
        EnvKey::Lib => Some(vec!["lib"]),
        #[cfg(windows)]
        EnvKey::Include => Some(vec!["include"]),
    }
}

pub fn mix(input: HashMap<String, Vec<String>>) -> HashMap<PlatformCaseAwareEnvKey, String> {
    let mut rv: HashMap<PlatformCaseAwareEnvKey, String> = HashMap::new();

    for (key, value) in std::env::vars() {
        rv.insert(construct_platform_case_aware_env_key(key), value);
    }

    for (key, value) in input.iter() {
        let key = &construct_platform_case_aware_env_key(key.clone());
        if let Some(values) = rv.get(key) {
            rv.insert(key.clone(), format!("{}{}{}", value.join(SEP), SEP, values));
        } else {
            rv.insert(key.clone(), value.join(SEP));
        }
    }

    rv
}

pub fn mix_runtime(
    input: &HashMap<PlatformCaseAwareEnvKey, String>,
    installations: &Vec<Installation>,
    conn: &Connection,
) -> Result<HashMap<PlatformCaseAwareEnvKey, String>, Box<dyn Error>> {
    let mut output: HashMap<PlatformCaseAwareEnvKey, String> = input
        .iter()
        .map(|(k, v)| (k.clone(), format!("{}{}${}", v, SEP, k)))
        .collect();

    for installation in installations.clone() {
        let runtime_env =
            crate::pantry_db::runtime_env_for_project(&installation.pkg.project, conn)?;
        for (key, runtime_value) in runtime_env {
            let runtime_value = expand_moustaches(&runtime_value, &installation, installations);
            let insert_key = construct_platform_case_aware_env_key(key.clone());
            let new_value = if let Some(curr_value) = output.get(&insert_key) {
                if runtime_value.contains(&format!("${}", key)) {
                    runtime_value.replace(&format!("${}", key), curr_value)
                } else {
                    // parent env overrides runtime env if the runtime env
                    // has no capacity to include the parent env
                    curr_value.clone()
                }
            } else if runtime_value.contains(&format!("${}", key)) {
                runtime_value
            } else {
                format!("${{{}:-{}}}", key, runtime_value)
            };
            output.insert(insert_key, new_value);
        }
    }

    Ok(output)
}

pub fn expand_moustaches(input: &str, pkg: &Installation, deps: &Vec<Installation>) -> String {
    let mut output = input.to_string();

    if output.starts_with("${{") {
        output.replace_range(..1, "");
    }

    output = output.replace("{{prefix}}", &pkg.path.to_string_lossy());
    output = output.replace("{{version}}", &format!("{}", &pkg.pkg.version));
    output = output.replace("{{version.major}}", &format!("{}", pkg.pkg.version.major));
    output = output.replace("{{version.minor}}", &format!("{}", pkg.pkg.version.minor));
    output = output.replace("{{version.patch}}", &format!("{}", pkg.pkg.version.patch));
    output = output.replace(
        "{{version.marketing}}",
        &format!("{}.{}", pkg.pkg.version.major, pkg.pkg.version.minor),
    );

    for dep in deps {
        let prefix = format!("deps.{}", dep.pkg.project);
        output = output.replace(
            &format!("{{{{{}.prefix}}}}", prefix),
            &dep.path.to_string_lossy(),
        );
        output = output.replace(
            &format!("{{{{{}.version}}}}", prefix),
            &format!("{}", &dep.pkg.version),
        );
        output = output.replace(
            &format!("{{{{{}.version.major}}}}", prefix),
            &format!("{}", dep.pkg.version.major),
        );
        output = output.replace(
            &format!("{{{{{}.version.minor}}}}", prefix),
            &format!("{}", dep.pkg.version.minor),
        );
        output = output.replace(
            &format!("{{{{{}.version.patch}}}}", prefix),
            &format!("{}", dep.pkg.version.patch),
        );
        output = output.replace(
            &format!("{{{{{}.version.marketing}}}}", prefix),
            &format!("{}.{}", dep.pkg.version.major, dep.pkg.version.minor),
        );
    }

    output
}
