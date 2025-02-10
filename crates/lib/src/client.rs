use reqwest::tls::Certificate;
use reqwest::Client;
use reqwest::ClientBuilder;

const CERT: &str = include_str!("dist_tea_xyz.pem");
const CERT2: &[u8; 1188] = include_bytes!("amazon_root_ca1.pem");

pub fn build_client() -> Result<Client, Box<dyn std::error::Error>> {
    let mut builder = ClientBuilder::new();

    // Split and parse each certificate in the PEM chain
    for cert_pem in CERT.split("-----END CERTIFICATE-----") {
        let cert_pem = cert_pem.trim();
        if cert_pem.is_empty() {
            continue;
        }

        let cert_pem = format!("{}{}", cert_pem, "\n-----END CERTIFICATE-----");
        let cert = Certificate::from_pem(cert_pem.as_bytes())?;
        builder = builder.add_root_certificate(cert);
    }

    let ca = Certificate::from_pem(CERT2)?;
    builder = builder.add_root_certificate(ca);

    let client = builder.build()?;
    Ok(client)
}
