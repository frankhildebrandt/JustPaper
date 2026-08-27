use std::path::{Path, PathBuf};

use ignore::WalkBuilder;
use serde::Serialize;

const SEARCH_LIMIT: usize = 200;
const MAX_FILE_BYTES: usize = 1_000_000;

#[derive(Serialize)]
pub struct SearchHit {
    path: String,
    line: u32,
    text: String,
}

/**
 * Lists project-relative markdown and text files under `root`.
 */
#[tauri::command]
pub fn list_project_files(root: String) -> Result<Vec<String>, String> {
    let root = PathBuf::from(root);
    let mut files = Vec::new();
    for entry in WalkBuilder::new(&root).standard_filters(true).build() {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry.file_type().map(|kind| kind.is_file()).unwrap_or(false) {
            continue;
        }
        let path = entry.path();
        if !is_note(path) {
            continue;
        }
        if let Some(relative) = relative_path(&root, path) {
            files.push(relative);
        }
    }
    files.sort();
    Ok(files)
}

/**
 * Searches note contents under `root` for a case-insensitive substring.
 */
#[tauri::command]
pub fn search_project(root: String, query: String) -> Result<Vec<SearchHit>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }
    let needle = query.to_lowercase();
    let files = list_project_files(root.clone())?;
    let root = PathBuf::from(root);
    let mut hits = Vec::new();
    for relative in files {
        if hits.len() >= SEARCH_LIMIT {
            break;
        }
        let absolute = root.join(&relative);
        let Ok(content) = std::fs::read_to_string(&absolute) else {
            continue;
        };
        if content.len() > MAX_FILE_BYTES {
            continue;
        }
        for (index, line) in content.lines().enumerate() {
            if hits.len() >= SEARCH_LIMIT {
                break;
            }
            if line.to_lowercase().contains(&needle) {
                hits.push(SearchHit {
                    path: relative.clone(),
                    line: (index + 1) as u32,
                    text: line.to_string(),
                });
            }
        }
    }
    Ok(hits)
}

fn is_note(path: &Path) -> bool {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .as_deref()
    {
        Some("md") | Some("txt") => true,
        _ => false,
    }
}

fn relative_path(root: &Path, path: &Path) -> Option<String> {
    path.strip_prefix(root)
        .ok()?
        .to_str()
        .map(|relative| relative.replace('\\', "/"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn with_vault(run: impl FnOnce(&Path)) {
        let dir = std::env::temp_dir().join(format!(
            "justpaper-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock")
                .as_nanos()
        ));
        fs::create_dir_all(dir.join("sub")).expect("mkdir");
        fs::write(dir.join("Hello.md"), "hello world\nsecond").expect("write md");
        fs::write(dir.join("sub").join("Note.txt"), "needle here").expect("write txt");
        fs::write(dir.join("binary.bin"), [0, 1, 2, 3]).expect("write bin");
        run(&dir);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn lists_only_notes() {
        with_vault(|dir| {
            let files = list_project_files(dir.to_string_lossy().into_owned()).unwrap();
            assert_eq!(
                files,
                vec!["Hello.md".to_string(), "sub/Note.txt".to_string()]
            );
        });
    }

    #[test]
    fn searches_case_insensitive_lines() {
        with_vault(|dir| {
            let hits =
                search_project(dir.to_string_lossy().into_owned(), "NEEDLE".into()).unwrap();
            assert_eq!(hits.len(), 1);
            assert_eq!(hits[0].path, "sub/Note.txt");
            assert_eq!(hits[0].line, 1);
        });
    }
}
