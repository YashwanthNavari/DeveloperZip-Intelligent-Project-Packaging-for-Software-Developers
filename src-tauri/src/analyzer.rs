use serde::{Deserialize, Serialize};
use std::path::Path;
use walkdir::WalkDir;

#[derive(Serialize, Deserialize)]
pub struct ProjectAnalysis {
    pub project_type: String,
    pub total_files: usize,
    pub total_size_bytes: u64,
    pub recommended_exclusions: Vec<String>,
}

pub fn analyze_directory(path: &str) -> ProjectAnalysis {
    let mut total_files = 0;
    let mut total_size_bytes = 0;
    
    // Simple fast walk to get total size and file count
    for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        let meta = entry.metadata();
        if let Ok(m) = meta {
            if m.is_file() {
                total_files += 1;
                total_size_bytes += m.len();
            }
        }
    }

    let p = Path::new(path);
    let mut project_type = "Unknown".to_string();
    let mut exclusions = vec![
        ".git".to_string(), 
        ".vscode".to_string(), 
        ".idea".to_string(), 
        ".DS_Store".to_string()
    ];

    if p.join("package.json").exists() {
        project_type = "Node.js (JavaScript/TypeScript)".to_string();
        exclusions.push("node_modules".to_string());
        exclusions.push("dist".to_string());
        exclusions.push(".next".to_string());
    } else if p.join("Cargo.toml").exists() {
        project_type = "Rust".to_string();
        exclusions.push("target".to_string());
    } else if p.join("requirements.txt").exists() || p.join("pyproject.toml").exists() {
        project_type = "Python".to_string();
        exclusions.push("venv".to_string());
        exclusions.push("__pycache__".to_string());
        exclusions.push(".pytest_cache".to_string());
    } else if p.join("pom.xml").exists() || p.join("build.gradle").exists() {
        project_type = "Java".to_string();
        exclusions.push("target".to_string());
        exclusions.push("build".to_string());
        exclusions.push(".gradle".to_string());
    }

    ProjectAnalysis {
        project_type,
        total_files,
        total_size_bytes,
        recommended_exclusions: exclusions,
    }
}
