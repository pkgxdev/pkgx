use std::{collections::HashMap, path::PathBuf, vec};

use libpkgx::{
    env::expand_moustaches, pantry_db,
    platform_case_aware_env_key::construct_platform_case_aware_env_key, types::Installation,
};
use serde::Serialize;
use serde_json::json;

pub fn dump(
    conn: rusqlite::Connection,
    installations: Vec<Installation>,
    flags: &crate::args::Flags,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(v) = flags.json {
        if v < 2 {
            let env = libpkgx::env::map(&installations);
            let mut runtime_env = HashMap::new();
            for pkg in installations.clone() {
                let pkg_runtime_env =
                    libpkgx::pantry_db::runtime_env_for_project(&pkg.pkg.project, &conn)?;
                if !pkg_runtime_env.is_empty() {
                    runtime_env.insert(pkg.pkg.project, pkg_runtime_env);
                }
            }
            let json = json!({
                "pkgs": installations,
                "env": env,
                "runtime_env": runtime_env
            });
            println!("{}", json);
        } else {
            let mut pkgs: HashMap<String, JsonV2Pkg> = HashMap::new();
            for installation in installations.clone() {
                let env = libpkgx::env::map(&vec![installation.clone()]);
                let project = installation.pkg.project.clone();

                let mut runtime_env = libpkgx::pantry_db::runtime_env_for_project(&project, &conn)?;

                for (installation_key, installation_value) in runtime_env.clone() {
                    let installation_value =
                        expand_moustaches(&installation_value, &installation, &installations);
                    runtime_env.insert(installation_key, installation_value);
                }

                let programs = pantry_db::programs_for_project(&project, &conn)?;
                let companions =
                    pantry_db::companions_for_projects(std::slice::from_ref(&project), &conn)?
                        .iter()
                        .map(|c| c.to_string())
                        .collect::<Vec<String>>();

                let pkg = JsonV2Pkg {
                    path: installation.path,
                    project,
                    version: installation.pkg.version,
                    env,
                    runtime_env,
                    programs,
                    companions,
                };
                pkgs.insert(pkg.project.clone(), pkg);
            }

            let json = json!({
                "pkgs": pkgs, "env": libpkgx::env::map(&installations)
            });
            println!("{}", json);
        }
    } else {
        let env = libpkgx::env::map(&installations);
        let env = env
            .iter()
            .map(|(k, v)| {
                (
                    construct_platform_case_aware_env_key(k.clone()),
                    v.join(":"),
                )
            })
            .collect();
        let env = libpkgx::env::mix_runtime(&env, &installations, &conn)?;
        for (key, value) in env {
            println!(
                "{}=\"{}\"",
                key,
                value.replace(&format!(":${}", key), &format!("${{{}:+:${}}}", key, key))
            );
        }
    }
    Ok(())
}

#[derive(Serialize)]
struct JsonV2Pkg {
    project: String,
    version: libpkgx::Version,
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    env: HashMap<String, Vec<String>>,
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    runtime_env: HashMap<String, String>,
    path: PathBuf,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    programs: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    companions: Vec<String>,
}
