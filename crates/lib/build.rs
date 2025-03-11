use std::env;

fn main() {
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap();

    let dist_url = if target_os == "windows" {
        option_env!("PKGX_DIST_URL").unwrap_or("https://dist.pkgx.dev/v2")
    } else {
        option_env!("PKGX_DIST_URL").unwrap_or("https://dist.pkgx.dev")
    };

    let default_pantry_tarball_filename = "pantry.tgz";
    let pantry_url =
        option_env!("PKGX_PANTRY_TARBALL_FILENAME").unwrap_or(default_pantry_tarball_filename);

    println!("cargo:rustc-env=PKGX_DIST_URL={dist_url}");
    println!("cargo:rustc-env=PKGX_PANTRY_TARBALL_FILENAME={pantry_url}");
}
