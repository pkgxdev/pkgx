#[cfg(unix)]
use nix::unistd::execve as nix_execve;
#[cfg(unix)]
use std::ffi::CString;

use libpkgx::platform_case_aware_env_key::PlatformCaseAwareEnvKey;
use std::{collections::HashMap, error::Error};

#[cfg(unix)]
pub fn execve(
    cmd: String,
    mut args: Vec<String>,
    env: HashMap<PlatformCaseAwareEnvKey, String>,
) -> Result<(), Box<dyn Error>> {
    // Convert the command to a CString

    let c_command = CString::new(cmd.clone())
        .map_err(|e| format!("Failed to convert command to CString: {}", e))?;

    // execve expects the command to be the first argument (yes, as well)
    args.insert(0, cmd);

    // Convert the arguments to CStrings and collect them into a Vec
    let c_args: Vec<CString> = args
        .iter()
        .map(|arg| {
            CString::new(arg.clone())
                .map_err(|e| format!("Failed to convert argument to CString: {}", e))
        })
        .collect::<Result<_, _>>()?;

    // Convert the environment to a Vec of `KEY=VALUE` strings
    let env_vars: Vec<String> = env
        .iter()
        .map(|(key, value)| format!("{}={}", key, value))
        .collect();

    // Convert the environment variables to CStrings and collect them into a Vec
    let c_env: Vec<CString> = env_vars
        .iter()
        .map(|env| {
            CString::new(env.clone())
                .map_err(|e| format!("Failed to convert environment variable to CString: {}", e))
        })
        .collect::<Result<_, _>>()?;

    // Replace the process with the new command, arguments, and environment
    let execve_result = nix_execve(&c_command, &c_args, &c_env);
    if execve_result.is_err() {
        let errno = execve_result.unwrap_err();
        return Err(format!("execve failed with errno: {}", errno).into());
    }

    Ok(())
}

#[cfg(windows)]
use std::process::{exit, Command};

#[cfg(windows)]
pub fn execve(
    cmd: String,
    args: Vec<String>,
    env: HashMap<PlatformCaseAwareEnvKey, String>,
) -> Result<(), Box<dyn Error>> {
    let status = Command::new(cmd)
        .args(args)
        .envs(env.iter().map(|(k, v)| (&k.0, v)))
        .spawn()?
        .wait()?;

    exit(status.code().unwrap_or(1));
}
