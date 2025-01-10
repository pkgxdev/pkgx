use crate::{config::Config, types::PackageReq};
use libsemverator::range::Range as VersionReq;
use serde::Deserialize;
use serde::Deserializer;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

pub struct PantryEntry {
    pub project: String,
    pub deps: Vec<PackageReq>,
    pub programs: Vec<String>,
    pub companions: Vec<PackageReq>,
    pub env: HashMap<String, String>,
}

impl PantryEntry {
    fn from_path(path: &PathBuf, pantry_dir: &PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        let project = path
            .parent()
            .unwrap()
            .strip_prefix(pantry_dir)
            .unwrap()
            .to_str()
            .unwrap()
            .to_string();

        Self::from_raw_entry(RawPantryEntry::from_path(path)?, project)
    }

    fn from_raw_entry(
        entry: RawPantryEntry,
        project: String,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let deps = if let Some(deps) = entry.dependencies {
            deps.0
                .iter()
                .map(|(project, constraint)| {
                    VersionReq::parse(constraint).map(|constraint| PackageReq {
                        project: project.clone(),
                        constraint,
                    })
                })
                .collect::<Result<Vec<_>, _>>()?
        } else {
            vec![]
        };

        let programs = if let Some(provides) = entry.provides {
            provides.0
        } else {
            vec![]
        };

        let companions = if let Some(companions) = entry.companions {
            companions
                .0
                .iter()
                .map(|(k, v)| {
                    VersionReq::parse(v).map(|constraint| PackageReq {
                        project: k.clone(),
                        constraint,
                    })
                })
                .collect::<Result<Vec<_>, _>>()?
        } else {
            vec![]
        };

        let env = if let Some(runtime) = entry.runtime {
            runtime.env
        } else {
            HashMap::new()
        };

        Ok(Self {
            deps,
            project,
            env,
            companions,
            programs,
        })
    }
}

pub struct PackageEntryIterator {
    stack: Vec<PathBuf>, // stack for directories to visit
    pantry_dir: PathBuf,
}

impl PackageEntryIterator {
    pub fn new(pantry_dir: PathBuf) -> Self {
        Self {
            stack: vec![pantry_dir.clone()],
            pantry_dir,
        }
    }
}

impl Iterator for PackageEntryIterator {
    type Item = PantryEntry;

    fn next(&mut self) -> Option<Self::Item> {
        while let Some(path) = self.stack.pop() {
            if path.is_dir() {
                // push subdirectories and files into the stack
                if let Ok(entries) = fs::read_dir(&path) {
                    for entry in entries.flatten() {
                        self.stack.push(entry.path());
                    }
                }
            } else if path.file_name() == Some("package.yml".as_ref()) {
                if let Ok(entry) = PantryEntry::from_path(&path, &self.pantry_dir) {
                    return Some(entry);
                } else if cfg!(debug_assertions) {
                    eprintln!("parse failure: {:?}", path);
                }
            }
        }
        None
    }
}

pub fn ls(config: &Config) -> PackageEntryIterator {
    PackageEntryIterator::new(config.pantry_dir.join("projects"))
}

#[derive(Debug, Deserialize)]
struct RawPantryEntry {
    dependencies: Option<Deps>,
    provides: Option<Provides>,
    companions: Option<Deps>,
    runtime: Option<Runtime>,
}

#[derive(Debug)]
struct Runtime {
    env: HashMap<String, String>,
}

impl<'de> Deserialize<'de> for Runtime {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[cfg(target_os = "macos")]
        let platform_key = "darwin";
        #[cfg(target_os = "linux")]
        let platform_key = "linux";
        #[cfg(target_os = "windows")]
        let platform_key = "windows";
        #[cfg(target_arch = "aarch64")]
        let arch_key = "aarch64";
        #[cfg(target_arch = "x86_64")]
        let arch_key = "x86-64";

        fn stringify(value: serde_yaml::Value) -> Option<String> {
            match value {
                serde_yaml::Value::String(s) => Some(s.clone()),
                serde_yaml::Value::Number(n) => Some(n.to_string()),
                serde_yaml::Value::Bool(b) => Some(b.to_string()),
                _ => None,
            }
        }

        let mut result = HashMap::new();

        let root: HashMap<String, serde_yaml::Value> = Deserialize::deserialize(deserializer)?;

        if let Some(env) = root.get("env").and_then(|x| x.as_mapping()).cloned() {
            for (key, value) in env {
                if key == "linux" || key == "darwin" || key == "windows" {
                    // If the key is platform-specific, only include values for the current platform
                    if key == platform_key {
                        if let serde_yaml::Value::Mapping(value) = value {
                            for (key, value) in value {
                                if let (Some(key), Some(value)) = (stringify(key), stringify(value))
                                {
                                    result.insert(key, value);
                                }
                            }
                        }
                    }
                } else if key == "aarch64" || key == "x86-64" {
                    if key == arch_key {
                        if let serde_yaml::Value::Mapping(value) = value {
                            for (key, value) in value {
                                if let (Some(key), Some(value)) = (stringify(key), stringify(value))
                                {
                                    result.insert(key, value);
                                }
                            }
                        }
                    }
                } else if let (Some(key), Some(value)) = (stringify(key), stringify(value)) {
                    result.insert(key, value);
                }
            }
        }
        Ok(Runtime { env: result })
    }
}

#[derive(Debug)]
struct Deps(HashMap<String, String>);

impl<'de> Deserialize<'de> for Deps {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        // Deserialize the map as a generic HashMap
        let full_map: HashMap<String, serde_yaml::Value> = Deserialize::deserialize(deserializer)?;

        // Determine the current platform
        #[cfg(target_os = "macos")]
        let platform_key = "darwin";

        #[cfg(target_os = "linux")]
        let platform_key = "linux";

        #[cfg(target_os = "windows")]
        let platform_key = "windows";

        // Create the result map
        let mut result = HashMap::new();

        fn handle_value(input: &serde_yaml::Value) -> Option<String> {
            match input {
                serde_yaml::Value::String(s) => Some(if s.chars().next().unwrap().is_numeric() {
                    format!("^{}", s)
                } else {
                    s.clone()
                }),
                serde_yaml::Value::Number(n) => Some(format!("^{}", n)),
                _ => None,
            }
        }

        for (key, value) in full_map {
            if key == "linux" || key == "darwin" || key == "windows" {
                // If the key is platform-specific, only include values for the current platform
                if key == platform_key {
                    if let serde_yaml::Value::Mapping(platform_values) = value {
                        for (k, v) in platform_values {
                            if let (serde_yaml::Value::String(k), Some(v)) = (k, handle_value(&v)) {
                                result.insert(k, v);
                            }
                        }
                    }
                }
            } else if let Some(value) = handle_value(&value) {
                result.insert(key, value);
            }
        }

        Ok(Deps(result))
    }
}

#[derive(Debug)]
struct Provides(Vec<String>);

impl<'de> Deserialize<'de> for Provides {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        // Define an enum to capture the possible YAML structures
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum ProvidesHelper {
            List(Vec<String>),
            Map(HashMap<String, Vec<String>>),
        }

        match ProvidesHelper::deserialize(deserializer)? {
            ProvidesHelper::List(list) => Ok(Provides(list)),
            ProvidesHelper::Map(map) => {
                #[cfg(target_os = "macos")]
                let key = "darwin";

                #[cfg(target_os = "linux")]
                let key = "linux";

                if let Some(values) = map.get(key) {
                    Ok(Provides(values.clone()))
                } else {
                    Ok(Provides(Vec::new())) // Return an empty Vec if the key isn't found
                }
            }
        }
    }
}

impl RawPantryEntry {
    fn from_path(path: &PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        let content = fs::read_to_string(path)?;
        Ok(serde_yaml::from_str(&content)?)
    }
}
