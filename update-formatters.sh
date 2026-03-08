#!/bin/bash

# Script to update all files to use centralized formatters

# Files to update with their specific patterns
declare -A files_to_update=(
  ["frontend/src/components/charts/TimeSeriesChart.tsx"]="formatTime"
  ["frontend/src/components/NodeCharts.tsx"]="formatTime"
  ["frontend/src/components/TasksTable.tsx"]="formatTimestamp"
  ["frontend/src/components/TaskDetailsModal.tsx"]="formatTimestamp"
  ["frontend/src/components/ClusterStatistics/TimeSeriesChart.tsx"]="formatTime"
  ["frontend/src/components/ClusterStatistics/ClusterStatistics.tsx"]="formatBytes"
  ["frontend/src/pages/ClusterView.tsx"]="formatBytes,formatPercent"
  ["frontend/src/pages/ShardManagement.tsx"]="formatBytes"
)

echo "Files that need formatter updates:"
for file in "${!files_to_update[@]}"; do
  if [ -f "$file" ]; then
    echo "  - $file (${files_to_update[$file]})"
  fi
done
