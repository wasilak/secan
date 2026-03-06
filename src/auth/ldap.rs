// LDAP authentication provider

/// Sanitizes user input to prevent LDAP injection attacks.
///
/// This function escapes LDAP special characters according to RFC 4515.
/// It should be called on all user-provided input before using it in LDAP search filters.
///
/// # Special Characters Escaped
///
/// - Backslash (`\`) → `\5c`
/// - Asterisk (`*`) → `\2a`
/// - Left parenthesis (`(`) → `\28`
/// - Right parenthesis (`)`) → `\29`
/// - Null byte (`\0`) → `\00`
///
/// # Examples
///
/// ```
/// use cerebro::auth::ldap::sanitize_ldap_input;
///
/// assert_eq!(sanitize_ldap_input("user*"), "user\\2a");
/// assert_eq!(sanitize_ldap_input("(admin)"), "\\28admin\\29");
/// assert_eq!(sanitize_ldap_input("user\\name"), "user\\5cname");
/// ```
///
/// # Security
///
/// This function prevents LDAP injection attacks by escaping characters that have
/// special meaning in LDAP search filters. Always use this function on user input
/// before constructing LDAP queries.
///
/// # References
///
/// - RFC 4515: LDAP String Representation of Search Filters
pub fn sanitize_ldap_input(input: &str) -> String {
    // Escape LDAP special characters according to RFC 4515
    // Note: Backslash must be escaped first to avoid double-escaping
    input
        .replace('\\', "\\5c") // Backslash must be first
        .replace('*', "\\2a") // Asterisk
        .replace('(', "\\28") // Left parenthesis
        .replace(')', "\\29") // Right parenthesis
        .replace('\0', "\\00") // Null byte
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_asterisk() {
        assert_eq!(sanitize_ldap_input("user*"), "user\\2a");
    }

    #[test]
    fn test_sanitize_parentheses() {
        assert_eq!(sanitize_ldap_input("(admin)"), "\\28admin\\29");
    }

    #[test]
    fn test_sanitize_backslash() {
        assert_eq!(sanitize_ldap_input("user\\name"), "user\\5cname");
    }

    #[test]
    fn test_sanitize_null_byte() {
        assert_eq!(sanitize_ldap_input("user\0name"), "user\\00name");
    }

    #[test]
    fn test_sanitize_multiple_special_chars() {
        assert_eq!(sanitize_ldap_input("user*(admin)"), "user\\2a\\28admin\\29");
    }

    #[test]
    fn test_sanitize_backslash_and_asterisk() {
        // Backslash should be escaped first, then asterisk
        assert_eq!(sanitize_ldap_input("user\\*"), "user\\5c\\2a");
    }

    #[test]
    fn test_sanitize_empty_string() {
        assert_eq!(sanitize_ldap_input(""), "");
    }

    #[test]
    fn test_sanitize_no_special_chars() {
        assert_eq!(sanitize_ldap_input("username"), "username");
    }

    #[test]
    fn test_sanitize_all_special_chars() {
        assert_eq!(sanitize_ldap_input("\\*()\0"), "\\5c\\2a\\28\\29\\00");
    }
}
