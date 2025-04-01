use std::collections::HashMap;

use libpkgx::{
    platform_case_aware_env_key::construct_platform_case_aware_env_key, types::Installation,
};
use serde_json::json;

pub fn dump(
    conn: rusqlite::Connection,
    installations: Vec<Installation>,
    env: HashMap<String, Vec<String>>,
    flags: &crate::args::Flags,
) -> Result<(), Box<dyn std::error::Error>> {
    if !flags.json {
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
    } else {
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
    }
    Ok(())
}
