#!/bin/bash
# Start all CleanMateX development infrastructure services

set -e

echo "🚀 Starting CleanMateX Development Infrastructure..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Docker is not running!${NC}"
    echo "Please start Docker Desktop and try again."
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Warning: .env file not found!${NC}"
    echo "Copying .env.example to .env..."
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env file${NC}"
    echo -e "${YELLOW}Please update .env with your configuration and run this script again.${NC}"
    exit 0
fi

# Step 1: Start Docker Compose services
echo -e "${BLUE}📦 Starting Docker Compose services...${NC}"
docker-compose up -d

# Step 2: Wait for services to be healthy
echo ""
echo -e "${BLUE}⏳ Waiting for services to become healthy...${NC}"

# Wait for PostgreSQL
echo -n "   PostgreSQL: "
while ! docker exec cmx-postgres pg_isready -U cmx_user -d cmx_db > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo -e " ${GREEN}✓${NC}"

# Wait for Redis
echo -n "   Redis: "
while ! docker exec cmx-redis redis-cli ping > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo -e " ${GREEN}✓${NC}"

# Wait for MinIO
echo -n "   MinIO: "
while ! curl -f http://localhost:9000/minio/health/live > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo -e " ${GREEN}✓${NC}"

# Step 3: Start Supabase (if not already running)
echo ""
echo -e "${BLUE}🔷 Starting Supabase local instance...${NC}"
cd supabase

if supabase status > /dev/null 2>&1; then
    echo -e "${YELLOW}ℹ️  Supabase is already running${NC}"
else
    supabase start
fi

cd ..

# Step 4: Display service URLs
echo ""
echo -e "${GREEN}✅ All services are running!${NC}"
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  📍 Service URLs"
echo "═══════════════════════════════════════════════════════"
echo -e "  PostgreSQL:        ${BLUE}localhost:5432${NC}"
echo -e "  Redis:             ${BLUE}localhost:6379${NC}"
echo -e "  MinIO API:         ${BLUE}http://localhost:9000${NC}"
echo -e "  MinIO Console:     ${BLUE}http://localhost:9001${NC}"
echo -e "  Redis Commander:   ${BLUE}http://localhost:8081${NC}"
echo -e "  Supabase API:      ${BLUE}http://localhost:54321${NC}"
echo -e "  Supabase Studio:   ${BLUE}http://localhost:54323${NC}"
echo -e "  Inbucket (Email):  ${BLUE}http://localhost:54324${NC}"
echo "═══════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}🎉 Ready to start developing!${NC}"
echo ""
echo "Next steps:"
echo "  1. cd web-admin && npm run dev      (Start admin dashboard)"
echo "  2. cd cmx-api && npm run start:dev   (Start cmx-api client API)"
echo ""
echo "To stop services: npm run services:stop"
echo ""

