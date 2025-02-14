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

    Ok(builder.build()?)
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
pub fn build_client() -> Result<Client, Box<dyn std::error::Error>> {
    Ok(ClientBuilder::new().build()?)
}
