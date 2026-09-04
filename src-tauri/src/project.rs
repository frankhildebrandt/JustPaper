use std::{
    fs::File,
    io::Read,
    path::{Path, PathBuf},
};

use ignore::WalkBuilder;
use serde::Serialize;

const SEARCH_LIMIT: usize = 200;
const MAX_FILE_BYTES: usize = 1_000_000;
const MAX_PROJECT_ENTRIES: usize = 50_000;
const MAX_PROJECT_FILES: usize = 10_000;
const MAX_PROJECT_PATH_BYTES: usize = 2_000_000;
const MAX_PROJECT_BYTES: usize = 50_000_000;

#[derive(Serialize)]
pub struct SearchHit {
    path: String,
    line: u32,
    text: String,
}

#[derive(Serialize)]
pub struct ProjectNote {
    path: String,
    content: String,
}

/**
 * Lists project-relative markdown, Typst, and text files under `root`.
 */
#[tauri::command]
pub fn list_project_files(root: String) -> Result<Vec<String>, String> {
    walk_project_files(&PathBuf::from(root), is_note)
}

/**
 * Lists project-relative files that are not notes, such as PDFs.
 */
#[tauri::command]
pub fn list_project_assets(root: String) -> Result<Vec<String>, String> {
    walk_project_files(&PathBuf::from(root), |path| !is_note(path))
}

fn walk_project_files(root: &Path, keep: impl Fn(&Path) -> bool) -> Result<Vec<String>, String> {
    walk_project_files_with_limits(
        root,
        keep,
        MAX_PROJECT_ENTRIES,
        MAX_PROJECT_FILES,
        MAX_PROJECT_PATH_BYTES,
    )
}

fn walk_project_files_with_limits(
    root: &Path,
    keep: impl Fn(&Path) -> bool,
    max_entries: usize,
    max_files: usize,
    max_path_bytes: usize,
) -> Result<Vec<String>, String> {
    let mut files = Vec::new();
    let mut entries = 0usize;
    let mut path_bytes = 0usize;
    for entry in WalkBuilder::new(root).standard_filters(true).build() {
        entries += 1;
        if entries > max_entries {
            return Err(format!(
                "project contains more than {max_entries} filesystem entries"
            ));
        }
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry
            .file_type()
            .map(|kind| kind.is_file())
            .unwrap_or(false)
        {
            continue;
        }
        let path = entry.path();
        if !keep(path) {
            continue;
        }
        if let Some(relative) = relative_path(root, path) {
            if files.len() >= max_files {
                return Err(format!(
                    "project contains more than {max_files} matching files"
                ));
            }
            account_bytes(
                &mut path_bytes,
                relative.len(),
                max_path_bytes,
                "project paths",
            )?;
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
    let mut bytes_read = 0usize;
    for relative in files {
        if hits.len() >= SEARCH_LIMIT {
            break;
        }
        let absolute = root.join(&relative);
        let Ok(Some(content)) = read_text_file_bounded(&absolute, MAX_FILE_BYTES) else {
            continue;
        };
        account_bytes(
            &mut bytes_read,
            content.len(),
            MAX_PROJECT_BYTES,
            "project search",
        )?;
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

/**
 * Reads project-relative note contents under `root`, skipping oversized files.
 */
#[tauri::command]
pub fn read_project_notes(root: String) -> Result<Vec<ProjectNote>, String> {
    let files = list_project_files(root.clone())?;
    let root = PathBuf::from(root);
    let mut notes = Vec::new();
    let mut bytes_read = 0usize;
    for relative in files {
        let absolute = root.join(&relative);
        let Ok(Some(content)) = read_text_file_bounded(&absolute, MAX_FILE_BYTES) else {
            continue;
        };
        account_bytes(
            &mut bytes_read,
            content.len(),
            MAX_PROJECT_BYTES,
            "project notes",
        )?;
        notes.push(ProjectNote {
            path: relative,
            content,
        });
    }
    Ok(notes)
}

fn read_text_file_bounded(path: &Path, max_bytes: usize) -> Result<Option<String>, String> {
    let metadata = std::fs::metadata(path).map_err(|error| error.to_string())?;
    if metadata.len() > max_bytes as u64 {
        return Ok(None);
    }
    let file = File::open(path).map_err(|error| error.to_string())?;
    let mut content = String::new();
    let mut bounded = file.take((max_bytes + 1) as u64);
    if bounded.read_to_string(&mut content).is_err() || content.len() > max_bytes {
        return Ok(None);
    }
    Ok(Some(content))
}

fn account_bytes(
    total: &mut usize,
    amount: usize,
    max_bytes: usize,
    operation: &str,
) -> Result<(), String> {
    *total = total
        .checked_add(amount)
        .filter(|next| *next <= max_bytes)
        .ok_or_else(|| format!("{operation} exceeds {max_bytes} bytes"))?;
    Ok(())
}

fn is_note(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.to_ascii_lowercase())
            .as_deref(),
        Some("md") | Some("txt") | Some("typ")
    )
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
        fs::write(dir.join("Paper.typ"), "= Title\n").expect("write typ");
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
                vec![
                    "Hello.md".to_string(),
                    "Paper.typ".to_string(),
                    "sub/Note.txt".to_string()
                ]
            );
        });
    }

    #[test]
    fn searches_case_insensitive_lines() {
        with_vault(|dir| {
            let hits = search_project(dir.to_string_lossy().into_owned(), "NEEDLE".into()).unwrap();
            assert_eq!(hits.len(), 1);
            assert_eq!(hits[0].path, "sub/Note.txt");
            assert_eq!(hits[0].line, 1);
        });
    }

    #[test]
    fn reads_note_contents_and_skips_non_notes() {
        with_vault(|dir| {
            let notes = read_project_notes(dir.to_string_lossy().into_owned()).unwrap();
            assert_eq!(notes.len(), 3);
            assert_eq!(notes[0].path, "Hello.md");
            assert_eq!(notes[0].content, "hello world\nsecond");
            assert_eq!(notes[1].path, "Paper.typ");
            assert_eq!(notes[1].content, "= Title\n");
            assert_eq!(notes[2].path, "sub/Note.txt");
            assert_eq!(notes[2].content, "needle here");
        });
    }

    #[test]
    fn lists_non_note_assets() {
        with_vault(|dir| {
            fs::write(dir.join("scan.pdf"), [1, 2, 3]).expect("write pdf");
            let assets = list_project_assets(dir.to_string_lossy().into_owned()).unwrap();
            assert_eq!(
                assets,
                vec!["binary.bin".to_string(), "scan.pdf".to_string()]
            );
        });
    }

    #[test]
    fn rejects_projects_over_the_file_budget() {
        with_vault(|dir| {
            let error = walk_project_files_with_limits(dir, is_note, usize::MAX, 2, usize::MAX)
                .unwrap_err();
            assert!(error.contains("more than 2"));
        });
    }

    #[test]
    fn rejects_projects_over_the_entry_budget() {
        with_vault(|dir| {
            let error = walk_project_files_with_limits(dir, |_| false, 1, usize::MAX, usize::MAX)
                .unwrap_err();
            assert!(error.contains("more than 1 filesystem entries"));
        });
    }

    #[test]
    fn skips_a_note_larger_than_the_per_file_budget() {
        with_vault(|dir| {
            fs::write(dir.join("Huge.md"), vec![b'a'; MAX_FILE_BYTES + 1])
                .expect("write oversized note");
            let notes = read_project_notes(dir.to_string_lossy().into_owned()).unwrap();
            assert!(!notes.iter().any(|note| note.path == "Huge.md"));
        });
    }

    #[test]
    fn rejects_aggregate_bytes_over_the_budget() {
        let mut total = 4;
        account_bytes(&mut total, 6, 10, "test").unwrap();
        assert_eq!(total, 10);
        assert!(account_bytes(&mut total, 1, 10, "test").is_err());
    }
}
