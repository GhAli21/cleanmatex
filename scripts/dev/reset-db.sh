#!/bin/bash
# Reset the CleanMateX database to a clean state

set -e

echo "🔄 Resetting CleanMateX Database..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Confirmation prompt
echo -e "${RED}⚠️  WARNING: This will delete all data in the database!${NC}"
read -p "Are you sure you want to continue? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Reset cancelled."
    exit 0
fi

# Step 1: Reset Supabase database
echo -e "${BLUE}🔷 Resetting Supabase database...${NC}"
cd supabase
supabase db reset
cd ..
echo -e "${GREEN}✓ Supabase database reset complete${NC}"

# Step 2: Optional - Reset PostgreSQL data (if using separate instance)
read -p "Also reset direct PostgreSQL data? (yes/no): " -r
echo ""

if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${BLUE}📦 Resetting PostgreSQL...${NC}"
    
    # Stop the container
    docker-compose stop postgres
    
    # Remove the volume
    docker volume rm cleanmatex_postgres_data 2>/dev/null || true
    
    # Restart the container
    docker-compose up -d postgres
    
    # Wait for PostgreSQL to be ready
    echo -n "   Waiting for PostgreSQL: "
    while ! docker exec cmx-postgres pg_isready -U cmx_user -d cmx_db > /dev/null 2>&1; do
        echo -n "."
        sleep 1
    done
    echo -e " ${GREEN}✓${NC}"
fi

# Step 3: Optional - Clear Redis cache
read -p "Clear Redis cache? (yes/no): " -r
echo ""

if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${BLUE}🗑️  Clearing Redis cache...${NC}"
    docker exec cmx-redis redis-cli FLUSHALL
    echo -e "${GREEN}✓ Redis cache cleared${NC}"
fi

echo -e "${GREEN}✅ Database reset complete!${NC}"
echo ""
echo "Run 'npm run services:start' to ensure all services are running."
echo ""

