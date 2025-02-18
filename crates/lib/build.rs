fn main() {
    let dist_url = option_env!("PKGX_DIST_URL").unwrap_or("https://dist.tea.xyz");
    let default_pantry_tarball_filename = "pantry.tgz";
    let pantry_url =
        option_env!("PKGX_PANTRY_TARBALL_FILENAME").unwrap_or(default_pantry_tarball_filename);

    println!("cargo:rustc-env=PKGX_DIST_URL={dist_url}");
    println!("cargo:rustc-env=PKGX_PANTRY_TARBALL_FILENAME={pantry_url}");
}
