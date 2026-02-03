use std::error::Error;

use libpkgx::{config::Config, inventory, pantry_db};
use rusqlite::{params, Connection};
use serde::Serialize;

use crate::{
    args::Flags,
    resolve::{parse_pkgspec, Pkgspec},
};

#[derive(Serialize)]
struct QueryResult {
    project: String,
    programs: Vec<String>,
}

pub async fn query(
    args: &Vec<String>,
    flags: &Flags,
    conn: &Connection,
    config: &Config,
) -> Result<(), Box<dyn Error>> {
    let is_json = flags.json == Some(2);
    let silent = flags.silent;

    // print out the whole list if no args
    if args.is_empty() {
        // if they requested json, output full mapping of project -> programs
        if is_json {
            let mut stmt =
                conn.prepare("SELECT DISTINCT project FROM provides ORDER BY project")?;
            let mut rows = stmt.query(params![])?;
            let mut results = Vec::new();
            while let Some(row) = rows.next()? {
                let project: String = row.get(0)?;
                let programs = get_programs(conn, &project)?;
                results.push(QueryResult { project, programs });
            }
            println!("{}", serde_json::to_string_pretty(&results)?);
        // if not, just list all programs
        } else {
            let mut stmt = conn.prepare("SELECT program FROM provides")?;
            let mut rows = stmt.query(params![])?;
            while let Some(row) = rows.next()? {
                let program: String = row.get(0)?;
                println!("{}", program);
            }
        }
        return Ok(());
    }

    let mut results = Vec::new();
    let mut fail = false;

    for arg in args {
        let mut pkgspec = parse_pkgspec(arg)?;

        let projects = match &mut pkgspec {
            Pkgspec::Req(req) if !req.project.contains('.') && req.constraint.raw == "*" => {
                pantry_db::which(&req.project, conn)?
            }
            Pkgspec::Req(req) => match resolve_project(&req.project, conn) {
                Ok(project) => {
                    req.project = project.clone();
                    vec![project]
                }
                Err(e) => {
                    if silent { std::process::exit(1); }
                    println!("{}", e);
                    fail = true;
                    continue;
                }
            },
            Pkgspec::Latest(name) => match resolve_project(name, conn) {
                Ok(project) => vec![project],
                Err(e) => {
                    if silent { std::process::exit(1); }
                    println!("{}", e);
                    fail = true;
                    continue;
                }
            },
        };

        if projects.is_empty() {
            if silent {
                std::process::exit(1);
            }
            println!("{} not found", arg);
            fail = true;
            continue;
        }

        // validate version constraint if specified
        if let Pkgspec::Req(req) = &pkgspec {
            if req.constraint.raw != "*" {
                let versions = inventory::ls(&projects[0], config).await?;
                if !versions.iter().any(|v| req.constraint.satisfies(v)) {
                    if silent {
                        std::process::exit(1);
                    }
                    println!("no versions matching {} found for {}", req.constraint.raw, projects[0]);
                    fail = true;
                    continue;
                }
            }
        }

        if is_json {
            for project in &projects {
                let programs = get_programs(conn, project)?;
                results.push(QueryResult {
                    project: project.clone(),
                    programs,
                });
            }
        } else if !silent {
            println!("{}", projects.join(", "));
        }
    }

    if is_json {
        println!("{}", serde_json::to_string_pretty(&results)?);
    }

    if fail {
        std::process::exit(1);
    }

    Ok(())
}

fn resolve_project(input: &str, conn: &Connection) -> Result<String, Box<dyn Error>> {
    let projects = pantry_db::which(&input.to_string(), conn)?;
    match projects.len() {
        1 => Ok(projects[0].clone()),
        0 => {
            if input.contains('.') {
                let mut stmt = conn.prepare("SELECT COUNT(*) FROM provides WHERE project = ?")?;
                let count: i64 = stmt.query_row(params![input], |row| row.get(0))?;
                if count > 0 {
                    return Ok(input.to_string());
                }
            }
            Err(format!("{} not found", input).into())
        }
        _ => Err(format!("{} is ambiguous: {}", input, projects.join(", ")).into()),
    }
}

fn get_programs(conn: &Connection, project: &str) -> Result<Vec<String>, Box<dyn Error>> {
    let mut stmt =
        conn.prepare("SELECT program FROM provides WHERE project = ? ORDER BY program")?;
    let mut rows = stmt.query(params![project])?;
    let mut programs = Vec::new();
    while let Some(row) = rows.next()? {
        programs.push(row.get(0)?);
    }
    Ok(programs)
}
