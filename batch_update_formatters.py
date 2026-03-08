#!/usr/bin/env python3
"""
Batch update formatter imports and remove local formatter functions
"""

import re

# Define file updates
updates = [
    {
        "file": "frontend/src/components/TasksTable.tsx",
        "add_import": "formatTimestamp",
        "remove_function": r"function formatTimestamp\(millis: number\): string \{\s*return new Date\(millis\)\.toLocaleString\(\);\s*\}",
    },
    {
        "file": "frontend/src/components/TaskDetailsModal.tsx",
        "add_import": "formatTimestamp",
        "remove_function": r"function formatTimestamp\(millis: number\): string \{\s*return new Date\(millis\)\.toLocaleString\(\);\s*\}",
    },
    {
        "file": "frontend/src/components/ClusterStatistics/TimeSeriesChart.tsx",
        "add_import": "formatChartTime",
        "remove_function": r"function formatTime\(timestamp: number\): string \{[^}]+\}",
        "replace_calls": [("formatTime(", "formatChartTime(")],
    },
    {
        "file": "frontend/src/components/ClusterStatistics/ClusterStatistics.tsx",
        "add_import": "formatBytes",
        "remove_function": r"function formatBytes\(bytes: number\): string \{[^}]+\}",
    },
    {
        "file": "frontend/src/pages/ClusterView.tsx",
        "add_import": "formatBytes, formatPercentRatio",
        "remove_functions": [
            r"function formatBytes\(bytes: number\): string \{[^}]+\}",
            r"function formatPercent\(used: number, total: number\): number \{[^}]+\}",
        ],
        "replace_calls": [("formatPercent(", "formatPercentRatio(")],
    },
    {
        "file": "frontend/src/pages/ShardManagement.tsx",
        "add_import": "formatBytes",
        "remove_function": r"function formatBytes\(bytes: number\): string \{[^}]+\}",
    },
]

print("Batch formatter update script created")
print(f"Will update {len(updates)} files")
