use libpkgx::types::PackageReq;
use rusqlite::Connection;

#[derive(Debug)]
pub enum WhichError {
    CmdNotFound(String),
    MultipleProjects(String, Vec<String>),
    DbError(rusqlite::Error),
}

impl std::fmt::Display for WhichError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WhichError::CmdNotFound(cmd) => write!(f, "cmd not found: {}", cmd),
            WhichError::MultipleProjects(cmd, projects) => {
                write!(f, "multiple projects found for {}: {:?}", cmd, projects)
            }
            WhichError::DbError(err) => write!(f, "db error: {}", err),
        }
    }
}

impl std::error::Error for WhichError {}

pub async fn which(
    cmd: &String,
    conn: &Connection,
    pkgs: &[PackageReq],
) -> Result<String, WhichError> {
    let candidates =
        libpkgx::pantry_db::projects_for_symbol(cmd, conn).map_err(WhichError::DbError)?;
    if candidates.len() == 1 {
        Ok(candidates[0].clone())
    } else if candidates.is_empty() {
        Err(WhichError::CmdNotFound(cmd.clone()))
    } else {
        let selected_pkgs = candidates
            .clone()
            .into_iter()
            .filter(|candidate| {
                pkgs.iter().any(|pkg| {
                    let PackageReq { project, .. } = pkg;
                    project == candidate
                })
            })
            .collect::<Vec<String>>();
        if selected_pkgs.len() == 1 {
            Ok(selected_pkgs[0].clone())
        } else {
            Err(WhichError::MultipleProjects(cmd.clone(), candidates))
        }
    }
}
