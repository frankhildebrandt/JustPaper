use tauri::{plugin::TauriPlugin, Runtime, Url};
use tauri_plugin_opener::OpenerExt;

const DEV_HOSTS: [&str; 2] = ["localhost", "127.0.0.1"];

/**
 * Keeps the webview on the bundled app and hands http(s) links to the system browser.
 */
pub fn guard<R: Runtime>() -> TauriPlugin<R> {
    tauri::plugin::Builder::new("navigation-guard")
        .on_navigation(|webview, url| {
            if is_app_url(url, cfg!(debug_assertions)) {
                return true;
            }
            if is_web_url(url) {
                let _ = webview.opener().open_url(url.as_str(), None::<&str>);
            }
            false
        })
        .build()
}

/**
 * Returns whether `url` belongs to the app frontend; dev hosts count only in debug builds.
 */
fn is_app_url(url: &Url, allow_dev_server: bool) -> bool {
    match url.scheme() {
        "tauri" | "about" => true,
        "http" | "https" => match url.host_str() {
            Some("tauri.localhost") => true,
            Some(host) => allow_dev_server && DEV_HOSTS.contains(&host),
            None => false,
        },
        _ => false,
    }
}

fn is_web_url(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(text: &str) -> Url {
        Url::parse(text).expect("valid url")
    }

    #[test]
    fn allows_the_bundled_frontend() {
        assert!(is_app_url(&url("tauri://localhost/index.html"), false));
        assert!(is_app_url(&url("http://tauri.localhost/"), false));
        assert!(is_app_url(&url("https://tauri.localhost/"), false));
    }

    #[test]
    fn allows_the_dev_server_only_in_debug_builds() {
        assert!(is_app_url(&url("http://localhost:1420/"), true));
        assert!(!is_app_url(&url("http://localhost:1420/"), false));
    }

    #[test]
    fn rejects_external_sites_and_files() {
        assert!(!is_app_url(&url("https://example.com/"), true));
        assert!(!is_app_url(&url("file:///etc/passwd"), true));
        assert!(!is_app_url(&url("javascript:alert(1)"), true));
    }

    #[test]
    fn detects_web_urls() {
        assert!(is_web_url(&url("https://example.com/")));
        assert!(!is_web_url(&url("file:///tmp/a")));
    }
}
