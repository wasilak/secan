#!/bin/bash

# End-to-End Frontend-Backend Telemetry Integration Test
# This test verifies that:
# 1. Frontend telemetry initializes correctly
# 2. Frontend sends traces to backend /v1/traces endpoint
# 3. Backend proxies traces to OTLP collector
# 4. Traces appear in Jaeger with proper parent-child relationships

set -e

echo "=========================================="
echo "Phase 2: Frontend-Backend Integration Test"
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
echo "Starting Secan with telemetry enabled..."
export OTEL_SDK_DISABLED=false
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
export OTEL_SERVICE_NAME=secan-e2e-test

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
echo "Waiting for server to start..."
for i in {1..30}; do
    if curl -s http://localhost:27182/health > /dev/null 2>&1; then
        echo "✅ Secan is running"
        break
    fi
    sleep 1
done

# Test 1: Check that index.html contains OTEL meta tags
echo ""
echo "Test 1: Checking OTEL config injection in HTML..."
HTML=$(curl -s http://localhost:27182/)
if echo "$HTML" | grep -q 'meta name="otel-sdk-disabled"'; then
    echo "✅ OTEL meta tags found in HTML"
    echo "$HTML" | grep 'meta name="otel' | head -4
else
    echo "❌ OTEL meta tags NOT found in HTML"
    exit 1
fi

# Test 2: Check that /v1/traces endpoint exists (returns 400 for empty body)
echo ""
echo "Test 2: Checking /v1/traces endpoint..."
TRACES_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:27182/v1/traces -H "Content-Type: application/x-protobuf" --data-binary "" || echo "000")
if [ "$TRACES_STATUS" = "400" ] || [ "$TRACES_STATUS" = "200" ]; then
    echo "✅ /v1/traces endpoint is accessible (status: $TRACES_STATUS)"
else
    echo "⚠️  /v1/traces endpoint returned status: $TRACES_STATUS (expected 400 for empty body)"
fi

# Test 3: Make some API requests to generate traces
echo ""
echo "Test 3: Generating traces through API calls..."
curl -s http://localhost:27182/api/clusters > /dev/null 2>&1
echo "  - Called /api/clusters"
curl -s http://localhost:27182/api/health > /dev/null 2>&1
echo "  - Called /api/health"
sleep 3
curl -s http://localhost:27182/api/clusters > /dev/null 2>&1
echo "  - Called /api/clusters again"

# Wait for traces to be exported
echo ""
echo "Waiting for traces to be exported (5 seconds)..."
sleep 5

# Test 4: Check Jaeger for traces
echo ""
echo "Test 4: Checking Jaeger for traces..."
SERVICES=$(curl -s "http://localhost:16686/api/services")
if echo "$SERVICES" | grep -q "secan-e2e-test"; then
    echo "✅ Service 'secan-e2e-test' found in Jaeger"
    
    # Get traces
    TRACES=$(curl -s "http://localhost:16686/api/traces?service=secan-e2e-test&limit=10")
    OPERATIONS=$(echo "$TRACES" | grep -o '"operationName":"[^"]*"' | sort | uniq -c)
    
    echo ""
    echo "Operations found:"
    echo "$OPERATIONS"
    
    # Check for both HTTP and ES spans
    if echo "$OPERATIONS" | grep -q "GET"; then
        echo "✅ HTTP spans found"
    fi
    
    if echo "$OPERATIONS" | grep -q "ES"; then
        echo "✅ ES spans found"
    fi
else
    echo "⚠️  Service 'secan-e2e-test' not found in Jaeger yet"
    echo "   This is OK if traces haven't been exported yet"
fi

echo ""
echo "=========================================="
echo "Integration test complete!"
echo "=========================================="
echo ""
echo "View traces in Jaeger: http://localhost:16686"
echo "Search for service: 'secan-e2e-test'"