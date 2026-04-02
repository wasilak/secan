#!/bin/bash

# Test trace context propagation
# This verifies that traceparent headers are properly extracted and used

set -e

echo "=========================================="
echo "Trace Context Propagation Test"
echo "=========================================="
echo ""

# Check if Jaeger is running
if ! curl -s http://localhost:16686/api/services > /dev/null 2>&1; then
    echo "❌ Jaeger not running. Start it with:"
    echo "   docker run -d --name jaeger -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one:latest"
    exit 1
fi

echo "✅ Jaeger is running"

# Start Secan with telemetry enabled
echo ""
echo "Starting Secan with telemetry..."
export OTEL_SDK_DISABLED=false
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
export OTEL_SERVICE_NAME=secan-trace-test

cd /Users/piotrek/git/secan
./target/release/secan &
SECAN_PID=$!

# Cleanup function
cleanup() {
    echo ""
    echo "Cleaning up..."
    kill $SECAN_PID 2>/dev/null || true
    wait $SECAN_PID 2>/dev/null || true
}
trap cleanup EXIT

# Wait for server to start
echo "Waiting for server..."
for i in {1..30}; do
    if curl -s http://localhost:27182/health > /dev/null 2>&1; then
        echo "✅ Secan is running"
        break
    fi
    sleep 1
done

# Test 1: Request with traceparent header (simulating frontend call)
echo ""
echo "Test 1: Request WITH traceparent header..."
TRACEPARENT="00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
echo "   traceparent: $TRACEPARENT"

RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:27182/api/clusters \
    -H "traceparent: $TRACEPARENT" \
    -H "Accept: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
echo "   HTTP Status: $HTTP_CODE"

# Wait for trace to be exported
sleep 3

# Test 2: Request without traceparent (should create new trace)
echo ""
echo "Test 2: Request WITHOUT traceparent header..."
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:27182/api/clusters \
    -H "Accept: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
echo "   HTTP Status: $HTTP_CODE"

# Wait for trace
sleep 3

# Check Jaeger
echo ""
echo "Checking Jaeger for traces..."

# Get traces for our service
TRACES=$(curl -s "http://localhost:16686/api/traces?service=secan-trace-test&limit=20")

# Count unique trace IDs
echo ""
echo "Trace analysis:"
echo "$TRACES" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    traces = data.get('data', [])
    print(f'Total traces: {len(traces)}')
    
    for trace in traces:
        spans = trace.get('spans', [])
        if spans:
            trace_id = spans[0].get('traceID', 'unknown')
            span_count = len(spans)
            print(f'  Trace {trace_id[:16]}...: {span_count} span(s)')
except Exception as e:
    print(f'Error parsing: {e}')
" 2>/dev/null || echo "Could not parse traces"

echo ""
echo "=========================================="
echo "Expected behavior:"
echo "- Test 1 should show: 1 span in trace ending with 'e4736'"
echo "- Test 2 should show: 1 span in a different trace"
echo ""
echo "If you see multiple traces with 1 span each, that's WRONG"
echo "You should see traces with multiple spans (parent-child)"
echo "=========================================="
echo ""
echo "View traces: http://localhost:16686"
echo "Search for: trace ID '4bf92f3577b34da6a3ce929d0e0e4736'"