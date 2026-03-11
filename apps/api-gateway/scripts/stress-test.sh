#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting LLM Gateway Load Test...${NC}"

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}Error: k6 is not installed.${NC}"
    echo -e "Please install k6 first:"
    echo -e "  Mac: brew install k6"
    echo -e "  Linux: https://k6.io/docs/get-started/installation/"
    exit 1
fi

# Cleanup function to ensure no orphan processes
cleanup() {
    if [ ! -z "$GATEWAY_PID" ]; then
        echo -e "${YELLOW}Stopping background Gateway process (PID: $GATEWAY_PID)...${NC}"
        kill $GATEWAY_PID 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

# Ensure services are running
echo -e "${YELLOW}Ensuring docker-compose services are up...${NC}"
cd deploy && docker-compose --profile dev up -d && cd ..

# Give LiteLLM a few seconds to warm up
echo -e "${YELLOW}Waiting for LiteLLM to be ready...${NC}"
sleep 5

# Start the NestJS Gateway in the background if it's not already running
# For a real load test, you should run the built production version, not start:dev
if ! curl -s http://localhost:3000/v1/models &> /dev/null; then
    echo -e "${YELLOW}Starting API Gateway (production build)...${NC}"
    pnpm run build
    # Set production node env to disable dev logging and optimize performance
    NODE_ENV=production node dist/apps/api-gateway/main.js &
    GATEWAY_PID=$!
    
    # Wait for gateway to start
    echo -e "${YELLOW}Waiting for Gateway to bind to port 3000...${NC}"
    while ! curl -s http://localhost:3000/v1/models &> /dev/null; do
        sleep 1
    done
else
    echo -e "${GREEN}API Gateway is already running on port 3000.${NC}"
fi

echo -e "${GREEN}All services ready. Commencing K6 Load Test (500 VUs).${NC}"

# Run K6
cd test/load
k6 run k6-test.js

echo -e "${GREEN}Load test completed.${NC}"
