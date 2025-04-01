use libpkgx::{
    config::Config,
    hydrate::hydrate,
    install_multi::install_multi,
    pantry_db, sync,
    types::{Installation, PackageReq},
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
        let PackageReq {
            project: project_or_cmd,
            constraint,
        } = PackageReq::parse(pkgspec)?;
        if config
            .pantry_dir
            .join("projects")
            .join(project_or_cmd.clone())
            .is_dir()
        {
            pkgs.push(PackageReq {
                project: project_or_cmd,
                constraint,
            });
        } else {
            let project = which::which(&project_or_cmd, conn, &pkgs).await?;
            pkgs.push(PackageReq {
                project,
                constraint,
            });
        }
    }

    if find_program {
        let PackageReq {
            constraint,
            project: cmd,
        } = PackageReq::parse(&args[0])?;

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

        pkgs.push(PackageReq {
            project,
            constraint,
        });
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
