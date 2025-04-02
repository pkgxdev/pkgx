use libpkgx::{
    config::Config,
    hydrate::hydrate,
    install_multi::install_multi,
    pantry_db, sync,
    types::{Installation, PackageReq},
    VersionRange,
};
use rusqlite::Connection;

use crate::{spinner::Spinner, which};

pub async fn resolve(
    args: &mut [String],
    plus: &[String],
    find_program: bool,
    config: &Config,
    conn: &mut Connection,
    did_sync: bool,
    spinner: &mut Spinner,
) -> std::result::Result<(Vec<Installation>, Vec<PackageReq>), Box<dyn std::error::Error>> {
    spinner.set_message("resolving pkg graph…");

    let mut pkgs = vec![];

    for pkgspec in plus {
        let mut pkgspec = parse_pkgspec(pkgspec)?;

        if !config
            .pantry_dir
            .join("projects")
            .join(pkgspec.project())
            .is_dir()
        {
            let project = which::which(&pkgspec.project(), conn, &pkgs).await?;
            pkgspec.set_project(project);
        }

        pkgs.push(pkgspec.pkgreq(config).await);
    }

    if find_program {
        let mut pkgspec = parse_pkgspec(&args[0])?;
        let cmd = pkgspec.project();

        args[0] = cmd.clone(); // invoke eg. `node` rather than eg. `node@20`

        let project = match which::which(&cmd, conn, &pkgs).await {
            Err(which::WhichError::CmdNotFound(cmd)) => {
                if !did_sync {
                    spinner.set_message(&format!("{} not found, syncing…", cmd));
                    sync::update(config, conn).await?; // cmd not found ∴ sync in case it is new
                    spinner.set_message("resolving pkg graph…");
                    which::which(&cmd, conn, &pkgs).await
                } else {
                    Err(which::WhichError::CmdNotFound(cmd))
                }
            }
            Err(err) => Err(err),
            Ok(project) => Ok(project),
        }?;

        pkgspec.set_project(project.clone());

        pkgs.push(pkgspec.pkgreq(config).await);
    }

    let companions = pantry_db::companions_for_projects(
        &pkgs
            .iter()
            .map(|project| project.project.clone())
            .collect::<Vec<_>>(),
        conn,
    )?;

    pkgs.extend(companions);

    let graph = hydrate(&pkgs, |project| pantry_db::deps_for_project(&project, conn)).await?;

    let resolution = libpkgx::resolve::resolve(&graph, config).await?;

    let mut installations = resolution.installed;
    if !resolution.pending.is_empty() {
        let installed = install_multi(&resolution.pending, config, spinner.arc()).await?;
        installations.extend(installed);
    }

    Ok((installations, graph))
}

enum Pkgspec {
    Req(PackageReq),
    Latest(String),
}

impl Pkgspec {
    fn project(&self) -> String {
        match self {
            Pkgspec::Req(req) => req.project.clone(),
            Pkgspec::Latest(project) => project.clone(),
        }
    }

    fn set_project(&mut self, project: String) {
        match self {
            Pkgspec::Req(req) => req.project = project,
            Pkgspec::Latest(_) => *self = Pkgspec::Latest(project),
        }
    }

    async fn constraint(&self, config: &Config) -> VersionRange {
        match self {
            Pkgspec::Req(req) => req.constraint.clone(),
            Pkgspec::Latest(project) => match libpkgx::inventory::ls(project, config).await {
                Ok(versions) if !versions.is_empty() => {
                    VersionRange::from_semver(versions.iter().max().unwrap()).unwrap()
                }
                _ => VersionRange::any(),
            },
        }
    }

    async fn pkgreq(&self, config: &Config) -> PackageReq {
        let project = self.project();
        let constraint = self.constraint(config).await;
        PackageReq {
            project,
            constraint,
        }
    }
}

fn parse_pkgspec(pkgspec: &str) -> Result<Pkgspec, Box<dyn std::error::Error>> {
    if let Some(project) = pkgspec.strip_suffix("@latest") {
        Ok(Pkgspec::Latest(project.to_string()))
    } else {
        let pkgspec = PackageReq::parse(pkgspec)?;
        Ok(Pkgspec::Req(pkgspec))
    }
}
