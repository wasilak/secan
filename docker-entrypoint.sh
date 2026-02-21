#!/bin/sh
set -e

# Execute the application as PID 1 to properly receive signals
exec /app/secan "$@"
