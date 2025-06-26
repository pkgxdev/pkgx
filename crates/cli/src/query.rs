use std::error::Error;

use libpkgx::{config::Config, inventory, pantry_db};
use rusqlite::{params, Connection};
use serde::Serialize;

use crate::resolve::{parse_pkgspec, Pkgspec};

#[derive(Serialize, Clone)]
struct QueryResult {
    project: String,
    programs: Vec<String>,
}

fn resolve_projects_for_pkgspec(
    pkgspec: &mut Pkgspec,
    conn: &Connection,
) -> Result<Vec<String>, Box<dyn Error>> {
    match pkgspec {
        Pkgspec::Req(pkgreq) => {
            // Check if this looks like a program name (no dots and wildcard constraint)
            if !pkgreq.project.contains('.') && pkgreq.constraint.raw == "*" {
                // Handle as program lookup
                Ok(pantry_db::which(&pkgreq.project, conn)?)
            } else {
                // Handle as package spec - resolve project name and return single project
                let (project, _) = resolve_project_name(&pkgreq.project, conn)?;
                pkgreq.project = project.clone();
                Ok(vec![project])
            }
        }
        Pkgspec::Latest(program_or_project) => {
            let (project, _) = resolve_project_name(program_or_project, conn)?;
            Ok(vec![project])
        }
    }
}

fn resolve_project_name(
    input: &str,
    conn: &Connection,
) -> Result<(String, String), Box<dyn Error>> {
    let original = input.to_string();

    // First, try to resolve as a program name
    let projects = pantry_db::which(&input.to_string(), conn)?;
    match projects.len() {
        0 => {
            // If not found as a program and contains a dot, check if it exists as a project
            if input.contains('.') {
                let mut stmt = conn.prepare("SELECT COUNT(*) FROM provides WHERE project = ?")?;
                let count: i64 = stmt.query_row(params![input], |row| row.get(0))?;
                if count > 0 {
                    return Ok((input.to_string(), original));
                }
            }
            Err(format!("Package '{}' not found", original).into())
        }
        1 => Ok((projects[0].clone(), original)),
        _ => Err(format!(
            "Package '{}' is ambiguous: {}",
            original,
            projects.join(", ")
        )
        .into()),
    }
}

fn get_programs_for_project(
    project: &str,
    conn: &Connection,
) -> Result<Vec<String>, Box<dyn Error>> {
    let mut stmt =
        conn.prepare("SELECT program FROM provides WHERE project = ? ORDER BY program")?;
    let mut rows = stmt.query(params![project])?;
    let mut programs = Vec::new();
    while let Some(row) = rows.next()? {
        programs.push(row.get(0)?);
    }
    Ok(programs)
}

async fn process_query_arg(
    arg: &str,
    conn: &Connection,
    config: &Config,
) -> Result<Vec<QueryResult>, Box<dyn Error>> {
    let mut pkgspec = parse_pkgspec(arg)?;
    let projects = resolve_projects_for_pkgspec(&mut pkgspec, conn)?;

    if projects.is_empty() {
        let name = match &pkgspec {
            Pkgspec::Req(req) => &req.project,
            Pkgspec::Latest(project) => project,
        };
        return Err(format!("{} not found", name).into());
    }

    let mut results = Vec::new();

    // Determine which projects to process
    let projects_to_process = match &pkgspec {
        Pkgspec::Req(pkgreq) if !pkgreq.project.contains('.') && pkgreq.constraint.raw == "*" => {
            // For program lookups (no dots and wildcard), process all matching projects
            &projects
        }
        _ => {
            // For package specs and latest, process first project only
            &projects[0..1]
        }
    };

    // Process each project
    for project in projects_to_process {
        // For version specs with constraints, check if any matching versions are available
        if let Pkgspec::Req(pkgreq) = &pkgspec {
            if pkgreq.constraint.raw != "*" {
                match inventory::ls(project, config).await {
                    Ok(versions) => {
                        let matching_versions: Vec<_> = versions
                            .iter()
                            .filter(|v| pkgreq.constraint.satisfies(v))
                            .collect();

                        if matching_versions.is_empty() {
                            return Err(format!(
                                "No versions matching {} found for {}",
                                pkgreq.constraint.raw, project
                            )
                            .into());
                        }
                    }
                    Err(_) => {
                        return Err(format!("Failed to get versions for {}", project).into());
                    }
                }
            }
        }

        let programs = get_programs_for_project(project, conn)?;
        results.push(QueryResult {
            project: project.clone(),
            programs,
        });
    }

    Ok(results)
}

fn format_standard_output(results: &[QueryResult]) -> Vec<String> {
    results
        .iter()
        .map(|result| result.project.clone())
        .collect()
}

fn format_json_output(results: &[QueryResult]) -> String {
    serde_json::to_string_pretty(results).unwrap_or_else(|_| "[]".to_string())
}

pub async fn query(
    args: &Vec<String>,
    silent: bool,
    conn: &Connection,
    json_version: Option<isize>,
    config: &Config,
) -> Result<(), Box<dyn Error>> {
    let is_json = json_version == Some(2);
    let mut all_results = Vec::new();

    if args.is_empty() {
        let mut stmt = conn.prepare("SELECT DISTINCT project FROM provides ORDER BY project")?;
        let mut rows = stmt.query(params![])?;

        while let Some(row) = rows.next()? {
            let project: String = row.get(0)?;
            let programs = get_programs_for_project(&project, conn)?;
            all_results.push(QueryResult { project, programs });
        }
    } else {
        for arg in args {
            let results = process_query_arg(arg, conn, config).await?;
            all_results.extend(results);
        }
    }

    if is_json {
        println!("{}", format_json_output(&all_results));
    } else if !silent {
        let output_lines = format_standard_output(&all_results);
        for line in output_lines {
            println!("{}", line);
        }
    }

    Ok(())
}
