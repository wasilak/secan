use crate::auth::AuthUser;
use crate::config::RoleConfig;
use std::collections::HashMap;

/// Role for RBAC with cluster access patterns
#[derive(Debug, Clone)]
pub struct Role {
    /// Role name
    pub name: String,
    /// Glob patterns for cluster access (e.g., "prod-*", "dev-*", "*")
    pub cluster_patterns: Vec<String>,
}

impl Role {
    /// Create a new role
    pub fn new(name: String, cluster_patterns: Vec<String>) -> Self {
        Self {
            name,
            cluster_patterns,
        }
    }

    /// Check if this role grants access to a specific cluster
    pub fn matches_cluster(&self, cluster_id: &str) -> bool {
        self.cluster_patterns.iter().any(|pattern| {
            if pattern == "*" {
                // Wildcard matches everything
                true
            } else if pattern.contains('*') {
                // Glob pattern matching
                glob_match(pattern, cluster_id)
            } else {
                // Exact match
                pattern == cluster_id
            }
        })
    }
}

impl From<RoleConfig> for Role {
    fn from(config: RoleConfig) -> Self {
        Self {
            name: config.name,
            cluster_patterns: config.cluster_patterns,
        }
    }
}

/// Simple glob pattern matching for cluster patterns
/// Supports * wildcard (matches any sequence of characters)
fn glob_match(pattern: &str, text: &str) -> bool {
    // If no wildcard, do exact match
    if !pattern.contains('*') {
        return pattern == text;
    }

    // Split pattern by * to get segments
    let segments: Vec<&str> = pattern.split('*').collect();

    if segments.is_empty() {
        return text.is_empty();
    }

    let mut text_pos = 0;

    for (i, segment) in segments.iter().enumerate() {
        if segment.is_empty() {
            continue;
        }

        // First segment must match at the start
        if i == 0 {
            if !text.starts_with(segment) {
                return false;
            }
            text_pos = segment.len();
            continue;
        }

        // Last segment must match at the end
        if i == segments.len() - 1 {
            if !text.ends_with(segment) {
                return false;
            }
            // Check if the segment appears after current position
            if let Some(pos) = text[text_pos..].find(segment) {
                text_pos += pos + segment.len();
            } else {
                return false;
            }
            continue;
        }

        // Middle segments must appear in order
        if let Some(pos) = text[text_pos..].find(segment) {
            text_pos += pos + segment.len();
        } else {
            return false;
        }
    }

    true
}

/// RBAC Manager for access control
#[derive(Debug, Clone)]
pub struct RbacManager {
    /// Map of role name to Role
    roles: HashMap<String, Role>,
}

impl RbacManager {
    /// Create a new RBAC manager from role configurations
    pub fn new(role_configs: Vec<RoleConfig>) -> Self {
        let roles = role_configs
            .into_iter()
            .map(|config| {
                let role = Role::from(config);
                (role.name.clone(), role)
            })
            .collect();

        Self { roles }
    }

    /// Get all accessible clusters for a user based on their roles
    pub fn get_accessible_clusters(
        &self,
        user: &AuthUser,
        all_cluster_ids: &[String],
    ) -> Vec<String> {
        let mut accessible = Vec::new();

        for cluster_id in all_cluster_ids {
            if self.can_access_cluster(user, cluster_id) {
                accessible.push(cluster_id.clone());
            }
        }

        accessible
    }

    /// Check if a user can access a specific cluster
    pub fn can_access_cluster(&self, user: &AuthUser, cluster_id: &str) -> bool {
        // Check each of the user's roles
        for user_role_name in &user.roles {
            if let Some(role) = self.roles.get(user_role_name) {
                if role.matches_cluster(cluster_id) {
                    return true;
                }
            }
        }

        false
    }

    /// Get a role by name
    pub fn get_role(&self, role_name: &str) -> Option<&Role> {
        self.roles.get(role_name)
    }

    /// Get all roles
    pub fn get_all_roles(&self) -> Vec<&Role> {
        self.roles.values().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_glob_match_wildcard() {
        assert!(glob_match("*", "anything"));
        assert!(glob_match("*", ""));
        assert!(glob_match("*", "prod-cluster-1"));
    }

    #[test]
    fn test_glob_match_prefix() {
        assert!(glob_match("prod-*", "prod-cluster-1"));
        assert!(glob_match("prod-*", "prod-"));
        assert!(!glob_match("prod-*", "dev-cluster-1"));
        assert!(!glob_match("prod-*", "production"));
    }

    #[test]
    fn test_glob_match_suffix() {
        assert!(glob_match("*-prod", "cluster-prod"));
        assert!(glob_match("*-prod", "-prod"));
        assert!(!glob_match("*-prod", "cluster-dev"));
        assert!(!glob_match("*-prod", "production"));
    }

    #[test]
    fn test_glob_match_middle() {
        assert!(glob_match("*-prod-*", "cluster-prod-1"));
        assert!(glob_match("*-prod-*", "a-prod-b"));
        assert!(!glob_match("*-prod-*", "cluster-dev-1"));
    }

    #[test]
    fn test_glob_match_multiple_wildcards() {
        assert!(glob_match("prod-*-*", "prod-cluster-1"));
        assert!(glob_match("prod-*-*", "prod-a-b"));
        assert!(glob_match("*-*-prod", "cluster-1-prod"));
        assert!(!glob_match("prod-*-*", "dev-cluster-1"));
    }

    #[test]
    fn test_glob_match_exact() {
        assert!(glob_match("prod-cluster-1", "prod-cluster-1"));
        assert!(!glob_match("prod-cluster-1", "prod-cluster-2"));
        assert!(!glob_match("prod-cluster-1", "prod-cluster-1-extra"));
    }

    #[test]
    fn test_role_matches_cluster_wildcard() {
        let role = Role::new("admin".to_string(), vec!["*".to_string()]);

        assert!(role.matches_cluster("prod-cluster-1"));
        assert!(role.matches_cluster("dev-cluster-1"));
        assert!(role.matches_cluster("any-cluster"));
    }

    #[test]
    fn test_role_matches_cluster_pattern() {
        let role = Role::new(
            "prod-admin".to_string(),
            vec!["prod-*".to_string(), "production-*".to_string()],
        );

        assert!(role.matches_cluster("prod-cluster-1"));
        assert!(role.matches_cluster("production-cluster-1"));
        assert!(!role.matches_cluster("dev-cluster-1"));
        assert!(!role.matches_cluster("staging-cluster-1"));
    }

    #[test]
    fn test_role_matches_cluster_exact() {
        let role = Role::new(
            "specific".to_string(),
            vec!["prod-cluster-1".to_string(), "prod-cluster-2".to_string()],
        );

        assert!(role.matches_cluster("prod-cluster-1"));
        assert!(role.matches_cluster("prod-cluster-2"));
        assert!(!role.matches_cluster("prod-cluster-3"));
        assert!(!role.matches_cluster("dev-cluster-1"));
    }

    #[test]
    fn test_rbac_manager_can_access_cluster() {
        let role_configs = vec![
            RoleConfig {
                name: "admin".to_string(),
                cluster_patterns: vec!["*".to_string()],
            },
            RoleConfig {
                name: "prod-viewer".to_string(),
                cluster_patterns: vec!["prod-*".to_string()],
            },
            RoleConfig {
                name: "dev-admin".to_string(),
                cluster_patterns: vec!["dev-*".to_string(), "staging-*".to_string()],
            },
        ];

        let rbac = RbacManager::new(role_configs);

        // Admin user with wildcard access
        let admin_user = AuthUser::new(
            "admin1".to_string(),
            "admin".to_string(),
            vec!["admin".to_string()],
        );

        assert!(rbac.can_access_cluster(&admin_user, "prod-cluster-1"));
        assert!(rbac.can_access_cluster(&admin_user, "dev-cluster-1"));
        assert!(rbac.can_access_cluster(&admin_user, "any-cluster"));

        // Prod viewer with limited access
        let prod_viewer = AuthUser::new(
            "viewer1".to_string(),
            "viewer".to_string(),
            vec!["prod-viewer".to_string()],
        );

        assert!(rbac.can_access_cluster(&prod_viewer, "prod-cluster-1"));
        assert!(rbac.can_access_cluster(&prod_viewer, "prod-cluster-2"));
        assert!(!rbac.can_access_cluster(&prod_viewer, "dev-cluster-1"));
        assert!(!rbac.can_access_cluster(&prod_viewer, "staging-cluster-1"));

        // Dev admin with multiple patterns
        let dev_admin = AuthUser::new(
            "devadmin1".to_string(),
            "devadmin".to_string(),
            vec!["dev-admin".to_string()],
        );

        assert!(rbac.can_access_cluster(&dev_admin, "dev-cluster-1"));
        assert!(rbac.can_access_cluster(&dev_admin, "staging-cluster-1"));
        assert!(!rbac.can_access_cluster(&dev_admin, "prod-cluster-1"));
    }

    #[test]
    fn test_rbac_manager_user_with_multiple_roles() {
        let role_configs = vec![
            RoleConfig {
                name: "prod-viewer".to_string(),
                cluster_patterns: vec!["prod-*".to_string()],
            },
            RoleConfig {
                name: "dev-admin".to_string(),
                cluster_patterns: vec!["dev-*".to_string()],
            },
        ];

        let rbac = RbacManager::new(role_configs);

        // User with multiple roles
        let user = AuthUser::new(
            "user1".to_string(),
            "user".to_string(),
            vec!["prod-viewer".to_string(), "dev-admin".to_string()],
        );

        assert!(rbac.can_access_cluster(&user, "prod-cluster-1"));
        assert!(rbac.can_access_cluster(&user, "dev-cluster-1"));
        assert!(!rbac.can_access_cluster(&user, "staging-cluster-1"));
    }

    #[test]
    fn test_rbac_manager_user_with_no_roles() {
        let role_configs = vec![RoleConfig {
            name: "admin".to_string(),
            cluster_patterns: vec!["*".to_string()],
        }];

        let rbac = RbacManager::new(role_configs);

        // User with no roles
        let user = AuthUser::new("user1".to_string(), "user".to_string(), vec![]);

        assert!(!rbac.can_access_cluster(&user, "prod-cluster-1"));
        assert!(!rbac.can_access_cluster(&user, "dev-cluster-1"));
    }

    #[test]
    fn test_rbac_manager_user_with_unknown_role() {
        let role_configs = vec![RoleConfig {
            name: "admin".to_string(),
            cluster_patterns: vec!["*".to_string()],
        }];

        let rbac = RbacManager::new(role_configs);

        // User with unknown role
        let user = AuthUser::new(
            "user1".to_string(),
            "user".to_string(),
            vec!["unknown-role".to_string()],
        );

        assert!(!rbac.can_access_cluster(&user, "prod-cluster-1"));
    }

    #[test]
    fn test_rbac_manager_get_accessible_clusters() {
        let role_configs = vec![
            RoleConfig {
                name: "prod-viewer".to_string(),
                cluster_patterns: vec!["prod-*".to_string()],
            },
            RoleConfig {
                name: "dev-admin".to_string(),
                cluster_patterns: vec!["dev-*".to_string()],
            },
        ];

        let rbac = RbacManager::new(role_configs);

        let all_clusters = vec![
            "prod-cluster-1".to_string(),
            "prod-cluster-2".to_string(),
            "dev-cluster-1".to_string(),
            "staging-cluster-1".to_string(),
        ];

        // User with prod-viewer role
        let user = AuthUser::new(
            "user1".to_string(),
            "user".to_string(),
            vec!["prod-viewer".to_string()],
        );

        let accessible = rbac.get_accessible_clusters(&user, &all_clusters);
        assert_eq!(accessible.len(), 2);
        assert!(accessible.contains(&"prod-cluster-1".to_string()));
        assert!(accessible.contains(&"prod-cluster-2".to_string()));

        // User with dev-admin role
        let user = AuthUser::new(
            "user2".to_string(),
            "user2".to_string(),
            vec!["dev-admin".to_string()],
        );

        let accessible = rbac.get_accessible_clusters(&user, &all_clusters);
        assert_eq!(accessible.len(), 1);
        assert!(accessible.contains(&"dev-cluster-1".to_string()));

        // User with both roles
        let user = AuthUser::new(
            "user3".to_string(),
            "user3".to_string(),
            vec!["prod-viewer".to_string(), "dev-admin".to_string()],
        );

        let accessible = rbac.get_accessible_clusters(&user, &all_clusters);
        assert_eq!(accessible.len(), 3);
        assert!(accessible.contains(&"prod-cluster-1".to_string()));
        assert!(accessible.contains(&"prod-cluster-2".to_string()));
        assert!(accessible.contains(&"dev-cluster-1".to_string()));
    }

    #[test]
    fn test_rbac_manager_get_role() {
        let role_configs = vec![RoleConfig {
            name: "admin".to_string(),
            cluster_patterns: vec!["*".to_string()],
        }];

        let rbac = RbacManager::new(role_configs);

        let role = rbac.get_role("admin");
        assert!(role.is_some());
        assert_eq!(role.unwrap().name, "admin");

        let role = rbac.get_role("unknown");
        assert!(role.is_none());
    }

    #[test]
    fn test_rbac_manager_get_all_roles() {
        let role_configs = vec![
            RoleConfig {
                name: "admin".to_string(),
                cluster_patterns: vec!["*".to_string()],
            },
            RoleConfig {
                name: "viewer".to_string(),
                cluster_patterns: vec!["prod-*".to_string()],
            },
        ];

        let rbac = RbacManager::new(role_configs);

        let roles = rbac.get_all_roles();
        assert_eq!(roles.len(), 2);
    }
}
