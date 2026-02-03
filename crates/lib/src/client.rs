use std::env;

use reqwest::{Client, ClientBuilder};

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
const CERT: &[u8] = include_bytes!("amazon_root_ca1.pem");

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn build_client() -> Result<Client, Box<dyn std::error::Error>> {
    let mut builder = ClientBuilder::new();

    let bndl = reqwest::Certificate::from_pem_bundle(CERT)?;
    for cert in bndl {
        builder = builder.add_root_certificate(cert);
    }

    builder = builder.user_agent(get_user_agent());

    Ok(builder.build()?)
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
pub fn build_client() -> Result<Client, Box<dyn std::error::Error>> {
    Ok(ClientBuilder::new().user_agent(get_user_agent()).build()?)
}

fn get_user_agent() -> String {
    let version = env!("CARGO_PKG_VERSION");
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    let group = env::var("PKGX_USER_AGENT_GROUP");
    let name = if let Ok(valid_group) = group {
        format!("pkgx[{}]", valid_group)
    } else {
        "pkgx".to_string()
    };
    format!("{name}/{version} ({os}; {arch})")
}
