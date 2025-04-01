use std::{collections::HashMap, result::Result};

use libpkgx::{
    platform_case_aware_env_key::{construct_platform_case_aware_env_key, PlatformCaseAwareEnvKey},
    types::{Installation, PackageReq},
    utils,
};
use regex::Regex;

use crate::args::Flags;

pub async fn exec(
    find_program: bool,
    mut args: Vec<String>,
    installations: Vec<Installation>,
    env: HashMap<String, Vec<String>>,
    flags: Flags,
    conn: rusqlite::Connection,
    graph: Vec<PackageReq>,
) -> Result<
    (
        String,
        Vec<String>,
        HashMap<PlatformCaseAwareEnvKey, String>,
    ),
    Box<dyn std::error::Error>,
> {
    let pkgx_lvl = std::env::var("PKGX_LVL")
        .unwrap_or("0".to_string())
        .parse()
        .unwrap_or(0)
        + 1;
    if pkgx_lvl >= 10 {
        return Err("PKGX_LVL exceeded: https://github.com/orgs/pkgxdev/discussions/11".into());
    }

    let cmd = if find_program {
        utils::find_program(&args.remove(0), &env["PATH"]).await?
    } else if args[0].contains('/') {
        // user specified a path to program which we should use
        args.remove(0)
    } else {
        // user wants a system tool, eg. pkgx +wget -- git clone
        // NOTE we still check the injected PATH since they may have added the tool anyway
        // it’s just this route allows the user to get a non-error for delegating through to the system
        let mut paths = vec![];
        if let Some(pkgpaths) = env.get("PATH") {
            paths.append(&mut pkgpaths.clone());
        }
        if let Ok(syspaths) = std::env::var("PATH") {
            #[cfg(windows)]
            let sep = ";";
            #[cfg(not(windows))]
            let sep = ":";
            paths.extend(
                syspaths
                    .split(sep)
                    .map(|x| x.to_string())
                    .collect::<Vec<String>>(),
            );
        }
        utils::find_program(&args.remove(0), &paths).await?
    };
    let env = libpkgx::env::mix(env);
    let mut env = libpkgx::env::mix_runtime(&env, &installations, &conn)?;

    let re = Regex::new(r"^\$\{\w+:-([^}]+)\}$").unwrap();

    #[cfg(unix)]
    let sep = ":";
    #[cfg(windows)]
    let sep = ";";

    for (key, value) in env.clone() {
        if let Some(caps) = re.captures(&value) {
            env.insert(key, caps.get(1).unwrap().as_str().to_string());
        } else {
            let cleaned_value = value
                .replace(&format!("{}${}", sep, key), "")
                .replace(&format!("${}{}", key, sep), "")
                .replace(&format!("; ${}", key), "") // one pantry instance of this
                .replace(&format!("${}", key), "");
            env.insert(key, cleaned_value);
        }
    }

    // fork bomb protection
    env.insert(
        construct_platform_case_aware_env_key("PKGX_LVL".to_string()),
        pkgx_lvl.to_string(),
    );

    env.insert(
        construct_platform_case_aware_env_key("PKGX_VERSION".to_string()),
        env!("CARGO_PKG_VERSION").to_string(),
    );

    // TODO should be output by +syntax too
    env.insert(
        construct_platform_case_aware_env_key("PKGX_ENV".to_string()),
        graph
            .iter()
            .map(|pkg| format!("{}", pkg))
            .collect::<Vec<String>>()
            .join(libpkgx::env::SEP),
    );

    if flags.shebang {
        // removes the filename of the shebang script
        args.remove(0);
    }

    Ok((cmd, args, env))
}
