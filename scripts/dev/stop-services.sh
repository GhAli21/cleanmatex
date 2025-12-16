#!/bin/bash
# Stop all CleanMateX development infrastructure services

set -e

echo "🛑 Stopping CleanMateX Development Infrastructure..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Stop Supabase
echo -e "${BLUE}🔷 Stopping Supabase...${NC}"
cd supabase

if supabase status > /dev/null 2>&1; then
    supabase stop
    echo -e "${GREEN}✓ Supabase stopped${NC}"
else
    echo -e "${YELLOW}ℹ️  Supabase is not running${NC}"
fi

cd ..

# Step 2: Stop Docker Compose services
echo ""
echo -e "${BLUE}📦 Stopping Docker Compose services...${NC}"
docker-compose stop

echo ""
echo -e "${GREEN}✅ All services stopped!${NC}"
echo ""
echo "Note: Data is preserved in Docker volumes."
echo "To remove all data, run: docker-compose down -v"
echo ""

