# CleanMateX

**Multi-tenant SaaS for Laundry & Dry Cleaning Management**

A comprehensive, scalable platform for managing laundry and dry cleaning operations with support for multiple tenants, stores, customers, and workflows.

## 🚀 Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd cleanmatex

# Copy environment template
cp .env.example .env

# Start infrastructure services
# Windows:
.\scripts\dev\start-services.ps1

# Linux/Mac:
./scripts/dev/start-services.sh

# Start web admin
cd web-admin
npm install
npm run dev
```

Visit http://localhost:3000 to access the admin dashboard.

## 📚 Documentation

- **[Development Setup Guide](docs/development-setup.md)** - Complete setup instructions
- **[Troubleshooting Guide](docs/troubleshooting.md)** - Common issues and solutions
- **[Master Plan](docs/plan/master_plan_cc_01.md)** - Project roadmap and architecture
- **[Current Task](docs/current-task.md)** - What we're working on now

## 🏗️ Project Structure

```
cleanmatex/
├── cmx-api/              # NestJS client API
├── web-admin/           # Next.js admin dashboard
├── mobile-apps/         # Flutter mobile apps
│   ├── customer-app/    # Customer mobile app
│   ├── driver-app/      # Driver mobile app
│   └── store-app/       # Store staff mobile app
├── supabase/            # Database, auth, storage
│   ├── migrations/      # Database migrations
│   └── seeds/          # Seed data
├── docs/               # Documentation
├── scripts/            # Development scripts
└── infra/              # Infrastructure configs
```

## 🛠️ Tech Stack

### Backend

- **Runtime:** Node.js 20+
- **Framework:** NestJS
- **Database:** PostgreSQL 16
- **Cache:** Redis 7
- **Storage:** MinIO (S3-compatible)
- **Auth:** Supabase Auth

### Frontend

- **Web Admin:** Next.js 14 (App Router)
- **UI Library:** React + TailwindCSS
- **State:** React Context / Zustand
- **Forms:** React Hook Form

### Mobile

- **Framework:** Flutter 3.x
- **State:** Provider / Riverpod
- **API:** REST + GraphQL

### Infrastructure

- **Containerization:** Docker + Docker Compose
- **Local Development:** Supabase CLI
- **CI/CD:** GitHub Actions (planned)

## 📦 Services

| Service         | Port  | Description            |
| --------------- | ----- | ---------------------- |
| Web Admin       | 3000  | Admin dashboard        |
| cmx-api         | 3001  | Client API (NestJS)     |
| PostgreSQL      | 5432  | Primary database       |
| Redis           | 6379  | Cache & queues         |
| MinIO API       | 9000  | S3-compatible storage  |
| MinIO Console   | 9001  | MinIO web UI           |
| Supabase API    | 54321 | Supabase REST API      |
| Supabase Studio | 54323 | Database management UI |
| Inbucket        | 54324 | Email testing          |

## 🎯 Features

### Core Features (MVP)

- ✅ Multi-tenant architecture
- ✅ Authentication & authorization
- ✅ Store management
- ✅ Customer management
- ✅ Order intake & tracking
- ✅ Basic workflow management
- ✅ Digital receipts

### Phase 2

- 📋 Advanced workflows
- 📋 Inventory management
- 📋 Driver management & routing
- 📋 Payment processing
- 📋 Reporting & analytics

### Phase 3

- 🔜 AI-powered features
- 🔜 Marketplace
- 🔜 Assembly services
- 🔜 Multi-language support

## 🧪 Testing

```bash
# Run smoke tests
npm run test:smoke

# Run unit tests
npm run test

# Run e2e tests
npm run test:e2e
```

## 🔧 Development Commands

### Infrastructure Management

```bash
# Start all services
npm run services:start

# Stop all services
npm run services:stop

# Reset database
./scripts/dev/reset-db.sh

# Validate environment
node scripts/validate-env.js
```

### Database Management

```bash
# Apply migrations
cd supabase && supabase db reset

# Create migration
cd supabase && supabase migration new <name>

# Generate types
cd supabase && supabase gen types typescript --local
```

## 🤝 Contributing

1. Read the [development setup guide](docs/development-setup.md)
2. Pick a task from the current sprint
3. Create a feature branch
4. Make your changes
5. Submit a pull request

## 📝 License

[Your License Here]

## 👥 Team

- **Product Owner:** [Name]
- **Tech Lead:** [Name]
- **DevOps:** [Name]

## 🔗 Links

- **Documentation:** [Link]
- **Project Board:** [Link]
- **Design System:** [Link]
