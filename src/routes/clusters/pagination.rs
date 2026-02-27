use serde::{Deserialize, Serialize};

/// Pagination query parameters
#[derive(Debug, Deserialize, Clone, Copy)]
pub struct PaginationParams {
    /// Page number (1-indexed)
    #[serde(default = "default_page")]
    pub page: usize,

    /// Items per page
    #[serde(default = "default_page_size")]
    pub page_size: usize,
}

fn default_page() -> usize {
    1
}

fn default_page_size() -> usize {
    50
}

impl PaginationParams {
    /// Validate pagination parameters
    pub fn validate(mut self) -> Result<Self, String> {
        // Ensure page is at least 1
        if self.page < 1 {
            self.page = 1;
        }

        // Ensure page_size is between 1 and 1000
        if self.page_size < 1 {
            self.page_size = 50;
        } else if self.page_size > 1000 {
            self.page_size = 1000;
        }

        Ok(self)
    }

    /// Calculate offset for Elasticsearch/database queries
    pub fn offset(&self) -> usize {
        (self.page - 1) * self.page_size
    }

    /// Calculate limit for Elasticsearch/database queries
    pub fn limit(&self) -> usize {
        self.page_size
    }
}

/// Generic paginated response wrapper
#[derive(Debug, Serialize, Clone)]
pub struct PaginatedResponse<T> {
    /// Items for the current page
    pub items: Vec<T>,

    /// Total count of all items across all pages
    pub total: usize,

    /// Current page number (1-indexed)
    pub page: usize,

    /// Items per page
    pub page_size: usize,

    /// Total number of pages
    pub total_pages: usize,
}

impl<T> PaginatedResponse<T> {
    /// Create a new paginated response
    pub fn new(items: Vec<T>, total: usize, page: usize, page_size: usize) -> Self {
        let total_pages = total.div_ceil(page_size);

        Self {
            items,
            total,
            page,
            page_size,
            total_pages,
        }
    }

    /// Create an empty paginated response
    pub fn empty(page: usize, page_size: usize) -> Self {
        Self::new(Vec::new(), 0, page, page_size)
    }
}

/// Helper to paginate a vec of items
pub fn paginate_vec<T: Clone>(
    items: Vec<T>,
    page: usize,
    page_size: usize,
) -> PaginatedResponse<T> {
    let total = items.len();
    let offset = (page - 1) * page_size;
    let end = std::cmp::min(offset + page_size, total);

    let paginated_items = if offset < total {
        items[offset..end].to_vec()
    } else {
        Vec::new()
    };

    PaginatedResponse::new(paginated_items, total, page, page_size)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pagination_params_validation() {
        let params = PaginationParams {
            page: 0,
            page_size: 0,
        };
        let validated = params.validate().unwrap();
        assert_eq!(validated.page, 1);
        assert_eq!(validated.page_size, 50);
    }

    #[test]
    fn test_pagination_params_max_page_size() {
        let params = PaginationParams {
            page: 1,
            page_size: 2000,
        };
        let validated = params.validate().unwrap();
        assert_eq!(validated.page_size, 1000);
    }

    #[test]
    fn test_paginate_vec() {
        let items: Vec<u32> = (1..=100).collect();
        let paginated = paginate_vec(items, 1, 25);

        assert_eq!(paginated.items.len(), 25);
        assert_eq!(paginated.total, 100);
        assert_eq!(paginated.total_pages, 4);
        assert_eq!(paginated.items[0], 1);
        assert_eq!(paginated.items[24], 25);
    }

    #[test]
    fn test_paginate_vec_last_page() {
        let items: Vec<u32> = (1..=100).collect();
        let paginated = paginate_vec(items, 4, 25);

        assert_eq!(paginated.items.len(), 25);
        assert_eq!(paginated.items[0], 76);
        assert_eq!(paginated.items[24], 100);
    }

    #[test]
    fn test_paginate_vec_out_of_range() {
        let items: Vec<u32> = (1..=10).collect();
        let paginated = paginate_vec(items, 5, 25);

        assert_eq!(paginated.items.len(), 0);
        assert_eq!(paginated.total, 10);
        assert_eq!(paginated.total_pages, 1);
    }
}
