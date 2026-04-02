use crate::config::GroupClusterMapping;

/// Resolves permissions by mapping user groups to accessible cluster IDs
#[derive(Debug, Clone)]
pub struct PermissionResolver {
    /// List of group to cluster mappings
    mappings: Vec<GroupClusterMapping>,
}

impl PermissionResolver {
    /// Create a new permission resolver from mappings
    pub fn new(mappings: Vec<GroupClusterMapping>) -> Self {
        Self { mappings }
    }

    /// Create an empty permission resolver (no permissions configured)
    pub fn empty() -> Self {
        Self {
            mappings: Vec::new(),
        }
    }

    /// Resolve accessible clusters for a user's groups
    ///
    /// Returns a set of cluster IDs that the user can access based on their groups
    /// and the configured group-cluster mappings.
    pub fn resolve_cluster_access(&self, user_groups: &[String]) -> Vec<String> {
        let mut accessible_clusters = std::collections::HashSet::new();

        for mapping in &self.mappings {
            // Check if this mapping applies to the user
            if self.group_matches(&mapping.group, user_groups) {
                // Add all clusters from this mapping
                for cluster in &mapping.clusters {
                    if cluster == "*" {
                        // Wildcard means all clusters are accessible
                        // Return a special marker that will be handled by the caller
                        return vec!["*".to_string()];
                    } else {
                        accessible_clusters.insert(cluster.clone());
                    }
                }
            }
        }

        accessible_clusters.into_iter().collect()
    }

    /// Check if a group pattern matches any of the user's groups
    fn group_matches(&self, pattern: &str, user_groups: &[String]) -> bool {
        if pattern == "*" {
            // Wildcard matches all users
            return true;
        }

        // Check if the pattern matches any user group (exact match)
        user_groups.iter().any(|group| group == pattern)
    }
}

/// Filter a list of clusters based on accessible cluster IDs
///
/// If accessible contains "*", returns all clusters.
/// Otherwise, returns only clusters in the accessible set.
pub fn filter_clusters(all_clusters: &[String], accessible: &[String]) -> Vec<String> {
    if accessible.contains(&"*".to_string()) {
        // Wildcard means access to all clusters
        return all_clusters.to_vec();
    }

    // Filter to only accessible clusters
    all_clusters
        .iter()
        .filter(|cluster| accessible.contains(cluster))
        .cloned()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_permission_resolver_empty() {
        let resolver = PermissionResolver::empty();
        let accessible = resolver.resolve_cluster_access(&["admin".to_string()]);
        assert!(accessible.is_empty());
    }

    #[test]
    fn test_permission_resolver_wildcard_cluster() {
        let mappings = vec![GroupClusterMapping {
            group: "admin".to_string(),
            clusters: vec!["*".to_string()],
        }];

        let resolver = PermissionResolver::new(mappings);
        let accessible = resolver.resolve_cluster_access(&["admin".to_string()]);
        assert_eq!(accessible.len(), 1);
        assert_eq!(accessible[0], "*");
    }

    #[test]
    fn test_permission_resolver_wildcard_group() {
        let mappings = vec![GroupClusterMapping {
            group: "*".to_string(),
            clusters: vec!["prod-1".to_string(), "prod-2".to_string()],
        }];

        let resolver = PermissionResolver::new(mappings);

        // Any user should get access
        let accessible = resolver.resolve_cluster_access(&["any-group".to_string()]);
        assert_eq!(accessible.len(), 2);
        assert!(accessible.contains(&"prod-1".to_string()));
        assert!(accessible.contains(&"prod-2".to_string()));

        // Even empty groups should get access
        let accessible = resolver.resolve_cluster_access(&[]);
        assert_eq!(accessible.len(), 2);
    }

    #[test]
    fn test_permission_resolver_specific_groups() {
        let mappings = vec![
            GroupClusterMapping {
                group: "admin".to_string(),
                clusters: vec!["prod-1".to_string(), "prod-2".to_string()],
            },
            GroupClusterMapping {
                group: "developer".to_string(),
                clusters: vec!["dev-1".to_string(), "dev-2".to_string()],
            },
        ];

        let resolver = PermissionResolver::new(mappings);

        // Admin user
        let accessible = resolver.resolve_cluster_access(&["admin".to_string()]);
        assert_eq!(accessible.len(), 2);
        assert!(accessible.contains(&"prod-1".to_string()));
        assert!(accessible.contains(&"prod-2".to_string()));

        // Developer user
        let accessible = resolver.resolve_cluster_access(&["developer".to_string()]);
        assert_eq!(accessible.len(), 2);
        assert!(accessible.contains(&"dev-1".to_string()));
        assert!(accessible.contains(&"dev-2".to_string()));

        // Unknown group
        let accessible = resolver.resolve_cluster_access(&["unknown".to_string()]);
        assert!(accessible.is_empty());
    }

    #[test]
    fn test_permission_resolver_multiple_user_groups() {
        let mappings = vec![
            GroupClusterMapping {
                group: "admin".to_string(),
                clusters: vec!["prod-1".to_string()],
            },
            GroupClusterMapping {
                group: "developer".to_string(),
                clusters: vec!["dev-1".to_string()],
            },
        ];

        let resolver = PermissionResolver::new(mappings);

        // User with multiple groups should get access to all matching clusters
        let accessible =
            resolver.resolve_cluster_access(&["admin".to_string(), "developer".to_string()]);
        assert_eq!(accessible.len(), 2);
        assert!(accessible.contains(&"prod-1".to_string()));
        assert!(accessible.contains(&"dev-1".to_string()));
    }

    #[test]
    fn test_permission_resolver_duplicate_clusters() {
        let mappings = vec![
            GroupClusterMapping {
                group: "admin".to_string(),
                clusters: vec!["prod-1".to_string(), "prod-2".to_string()],
            },
            GroupClusterMapping {
                group: "admin".to_string(),
                clusters: vec!["prod-2".to_string(), "prod-3".to_string()],
            },
        ];

        let resolver = PermissionResolver::new(mappings);

        let accessible = resolver.resolve_cluster_access(&["admin".to_string()]);
        assert_eq!(accessible.len(), 3);
        assert!(accessible.contains(&"prod-1".to_string()));
        assert!(accessible.contains(&"prod-2".to_string()));
        assert!(accessible.contains(&"prod-3".to_string()));
    }

    #[test]
    fn test_permission_resolver_empty_user_groups() {
        let mappings = vec![GroupClusterMapping {
            group: "admin".to_string(),
            clusters: vec!["prod-1".to_string()],
        }];

        let resolver = PermissionResolver::new(mappings);

        let accessible = resolver.resolve_cluster_access(&[]);
        assert!(accessible.is_empty());
    }

    #[test]
    fn test_filter_clusters_with_wildcard() {
        let all_clusters = vec![
            "prod-1".to_string(),
            "prod-2".to_string(),
            "dev-1".to_string(),
        ];
        let accessible = vec!["*".to_string()];

        let filtered = filter_clusters(&all_clusters, &accessible);
        assert_eq!(filtered.len(), 3);
    }

    #[test]
    fn test_filter_clusters_specific() {
        let all_clusters = vec![
            "prod-1".to_string(),
            "prod-2".to_string(),
            "dev-1".to_string(),
        ];
        let accessible = vec!["prod-1".to_string(), "dev-1".to_string()];

        let filtered = filter_clusters(&all_clusters, &accessible);
        assert_eq!(filtered.len(), 2);
        assert!(filtered.contains(&"prod-1".to_string()));
        assert!(filtered.contains(&"dev-1".to_string()));
        assert!(!filtered.contains(&"prod-2".to_string()));
    }

    #[test]
    fn test_filter_clusters_empty_accessible() {
        let all_clusters = vec![
            "prod-1".to_string(),
            "prod-2".to_string(),
            "dev-1".to_string(),
        ];
        let accessible = vec![];

        let filtered = filter_clusters(&all_clusters, &accessible);
        assert!(filtered.is_empty());
    }
}
