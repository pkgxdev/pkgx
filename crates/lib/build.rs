fn main() {
    let dist_url = option_env!("PKGX_DIST_URL").unwrap_or("https://dist.pkgx.dev");
    let default_pantry_url = format!("{dist_url}/pantry.tgz");
    let pantry_url = option_env!("PKGX_PANTRY_TARBALL_URL").unwrap_or(&default_pantry_url);

    println!("cargo:rustc-env=PKGX_DIST_URL={dist_url}");
    println!("cargo:rustc-env=PKGX_PANTRY_TARBALL_URL={pantry_url}");
}
