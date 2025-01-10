use std::{collections::HashMap, error::Error};

use rusqlite::{params, Connection};

use crate::{config::Config, pantry, types::PackageReq};

pub fn cache(config: &Config, conn: &mut Connection) -> Result<(), Box<dyn Error>> {
    conn.execute_batch(
        "
    PRAGMA synchronous = OFF;
    PRAGMA journal_mode = MEMORY;
    PRAGMA temp_store = MEMORY;
    DROP TABLE IF EXISTS provides;
    DROP TABLE IF EXISTS dependencies;
    DROP TABLE IF EXISTS companions;
    DROP TABLE IF EXISTS runtime_env;
    CREATE TABLE provides (
        project TEXT,
        program TEXT
    );
    CREATE TABLE dependencies (
        project TEXT,
        pkgspec TEXT
    );
    CREATE TABLE companions (
        project TEXT,
        pkgspec TEXT
    );
    CREATE TABLE runtime_env (
        project TEXT,
        envline TEXT
    );
    CREATE INDEX idx_project ON provides(project);
    CREATE INDEX idx_program ON provides(program);
    CREATE INDEX idx_project_dependencies ON dependencies(project);
    CREATE INDEX idx_project_companions ON companions(project);
    ",
    )?;

    let tx = conn.transaction()?;

    for pkg in pantry::ls(config) {
        for mut program in pkg.programs {
            program = std::path::Path::new(&program)
                .file_name()
                .unwrap()
                .to_str()
                .unwrap()
                .to_string();
            tx.execute(
                "INSERT INTO provides (project, program) VALUES (?1, ?2);",
                params![pkg.project, program],
            )?;
        }

        for dep in pkg.deps {
            tx.execute(
                "INSERT INTO dependencies (project, pkgspec) VALUES (?1, ?2);",
                params![pkg.project, dep.to_string()],
            )?;
        }

        for companion in pkg.companions {
            tx.execute(
                "INSERT INTO companions (project, pkgspec) VALUES (?1, ?2);",
                params![pkg.project, companion.to_string()],
            )?;
        }

        for (key, value) in pkg.env {
            tx.execute(
                "INSERT INTO runtime_env (project, envline) VALUES (?1, ?2);",
                params![pkg.project, format!("{}={}", key, value)],
            )?;
        }
    }

    tx.commit()?;

    Ok(())
}

pub fn deps_for_project(
    project: &String,
    conn: &Connection,
) -> Result<Vec<PackageReq>, Box<dyn Error>> {
    let mut stmt = conn.prepare("SELECT pkgspec FROM dependencies WHERE project = ?1")?;
    let rv = stmt.query_map(params![project], |row| {
        let pkgspec: String = row.get(0)?;
        let pkgrq = PackageReq::parse(&pkgspec).unwrap(); //FIXME unwrap()
        Ok(pkgrq)
    })?;
    Ok(rv.collect::<Result<Vec<_>, _>>()?)
}

pub fn which(cmd: &String, conn: &Connection) -> Result<Vec<String>, rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT project FROM provides WHERE program = ?1")?;
    let mut rv = Vec::new();
    let mut rows = stmt.query(params![cmd])?;
    while let Some(row) = rows.next()? {
        rv.push(row.get(0)?);
    }
    Ok(rv)
}

pub fn runtime_env_for_project(
    project: &String,
    conn: &Connection,
) -> Result<HashMap<String, String>, Box<dyn Error>> {
    let sql = "SELECT envline FROM runtime_env WHERE project = ?1";
    let mut stmt = conn.prepare(sql)?;
    let mut rows = stmt.query(params![project])?;
    let mut env = HashMap::new();
    while let Some(row) = rows.next()? {
        let envline: String = row.get(0)?;
        let (key, value) = envline.split_once('=').unwrap();
        env.insert(key.to_string(), value.to_string());
    }
    Ok(env)
}

pub fn companions_for_projects(
    projects: &[String],
    conn: &Connection,
) -> Result<Vec<PackageReq>, Box<dyn Error>> {
    if projects.is_empty() {
        return Ok(Vec::new());
    }

    // Generate placeholders for the IN clause (?, ?, ?, ...)
    let placeholders = projects.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let query = format!(
        "SELECT pkgspec FROM companions WHERE project IN ({})",
        placeholders
    );

    let mut stmt = conn.prepare(&query)?;

    let companions = stmt.query_map(
        rusqlite::params_from_iter(projects.iter()), // Efficiently bind the projects
        |row| {
            let pkgspec: String = row.get(0)?;
            let pkgrq = PackageReq::parse(&pkgspec).unwrap(); //TODO handle error!
            Ok(pkgrq)
        },
    )?;

    // Collect results into a Vec<PackageReq>, propagating errors
    Ok(companions.collect::<Result<Vec<_>, _>>()?)
}
