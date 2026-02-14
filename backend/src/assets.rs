use rust_embed::RustEmbed;

/// Embedded frontend assets
///
/// This struct embeds all frontend assets (HTML, CSS, JS, etc.) into the binary
/// at compile time using rust-embed. The assets are built by the frontend
/// (Vite + React) and placed in the `assets/` directory.
///
/// # Requirements
///
/// Validates: Requirements 1.1, 1.2
#[derive(RustEmbed)]
#[folder = "assets/"]
pub struct Assets;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_assets_embed() {
        // Verify that index.html is embedded
        let index = Assets::get("index.html");
        assert!(index.is_some(), "index.html should be embedded");

        // Verify the content is not empty
        let index_content = index.unwrap();
        assert!(
            !index_content.data.is_empty(),
            "index.html should not be empty"
        );
    }

    #[test]
    fn test_assets_list() {
        // Get all embedded files
        let files: Vec<_> = Assets::iter().collect();

        // Should have at least index.html
        assert!(!files.is_empty(), "Should have at least one embedded file");

        // Verify index.html is in the list
        assert!(
            files.iter().any(|f| f.as_ref() == "index.html"),
            "index.html should be in the embedded files list"
        );
    }
}
