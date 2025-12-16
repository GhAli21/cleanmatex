#!/bin/bash
# Smoke tests for CleanMateX infrastructure
# Verifies that all services are running and accessible

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Running CleanMateX Infrastructure Smoke Tests...${NC}"
echo ""

FAILED_TESTS=0
PASSED_TESTS=0

# Test function
test_service() {
    local name=$1
    local test_command=$2
    
    echo -n "Testing $name... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED_TESTS++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        ((FAILED_TESTS++))
        return 1
    fi
}

# Test PostgreSQL
test_service "PostgreSQL" "docker exec cmx-postgres pg_isready -U cmx_user -d cmx_db"

# Test PostgreSQL connection with query
test_service "PostgreSQL Query" "docker exec cmx-postgres psql -U cmx_user -d cmx_db -c 'SELECT 1' -t -A | grep -q 1"

# Test Redis
test_service "Redis" "docker exec cmx-redis redis-cli ping | grep -q PONG"

# Test Redis operations
test_service "Redis SET/GET" "docker exec cmx-redis sh -c 'redis-cli SET smoke_test ok && redis-cli GET smoke_test | grep -q ok'"

# Cleanup Redis test key
docker exec cmx-redis redis-cli DEL smoke_test > /dev/null 2>&1

# Test MinIO
test_service "MinIO Health" "curl -f http://localhost:9000/minio/health/live"

# Test MinIO Console
test_service "MinIO Console" "curl -f http://localhost:9001"

# Test Redis Commander
test_service "Redis Commander" "curl -f http://localhost:8081"

# Test Supabase API
test_service "Supabase API" "curl -f http://localhost:54321/rest/v1/"

# Test Supabase Studio
test_service "Supabase Studio" "curl -f http://localhost:54323"

# Test Inbucket (Email)
test_service "Inbucket Email UI" "curl -f http://localhost:54324"

# Check Docker network
test_service "Docker Network" "docker network inspect cmx-network"

# Check Docker volumes
test_service "PostgreSQL Volume" "docker volume inspect cleanmatex_postgres_data"
test_service "Redis Volume" "docker volume inspect cleanmatex_redis_data"
test_service "MinIO Volume" "docker volume inspect cleanmatex_minio_data"

# Summary
echo ""
echo "═══════════════════════════════════════════════════════"
echo -e "  Test Results"
echo "═══════════════════════════════════════════════════════"
echo -e "  Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "  Failed: ${RED}$FAILED_TESTS${NC}"
echo "═══════════════════════════════════════════════════════"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ All smoke tests passed!${NC}"
    echo "Infrastructure is healthy and ready for development."
    exit 0
else
    echo -e "${RED}❌ Some tests failed!${NC}"
    echo "Please check the failed services and try again."
    exit 1
fi

