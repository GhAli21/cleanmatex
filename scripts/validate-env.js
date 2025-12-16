#!/usr/bin/env node
/**
 * Environment Variables Validation Script
 * Validates that all required environment variables are set
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// Define required environment variables
const requiredVars = {
  // Core
  NODE_ENV: { description: 'Environment (development/staging/production)' },
  
  // Database
  DATABASE_URL: { description: 'PostgreSQL connection string' },
  
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: { description: 'Supabase API URL' },
  NEXT_PUBLIC_SUPABASE_ANON_KEY: { description: 'Supabase anonymous key' },
  
  // Redis
  REDIS_URL: { description: 'Redis connection URL' },
  
  // Application
  APP_PORT: { description: 'Backend API port' },
  APP_URL: { description: 'Backend API URL' },
};

// Optional but recommended variables
const recommendedVars = {
  JWT_SECRET: { description: 'JWT signing secret' },
  SESSION_SECRET: { description: 'Session encryption secret' },
  SUPABASE_SERVICE_ROLE_KEY: { description: 'Supabase service role key (backend only)' },
  S3_ENDPOINT: { description: 'S3/MinIO endpoint' },
};

// Load .env file
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  
  if (!fs.existsSync(envPath)) {
    console.error(`${colors.red}❌ Error: .env file not found!${colors.reset}`);
    console.log(`\nPlease copy .env.example to .env:`);
    console.log(`  cp .env.example .env`);
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};

  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim();
      if (key && value) {
        env[key] = value;
      }
    }
  });

  return env;
}

// Validate environment variables
function validateEnv(env) {
  console.log(`${colors.blue}🔍 Validating environment variables...${colors.reset}\n`);

  let hasErrors = false;
  let hasWarnings = false;

  // Check required variables
  console.log(`${colors.blue}Required Variables:${colors.reset}`);
  for (const [varName, config] of Object.entries(requiredVars)) {
    if (!env[varName] || env[varName] === '') {
      console.log(`  ${colors.red}✗${colors.reset} ${varName}: ${colors.red}MISSING${colors.reset}`);
      console.log(`    → ${config.description}`);
      hasErrors = true;
    } else {
      console.log(`  ${colors.green}✓${colors.reset} ${varName}`);
    }
  }

  // Check recommended variables
  console.log(`\n${colors.blue}Recommended Variables:${colors.reset}`);
  for (const [varName, config] of Object.entries(recommendedVars)) {
    if (!env[varName] || env[varName] === '') {
      console.log(`  ${colors.yellow}⚠${colors.reset} ${varName}: ${colors.yellow}NOT SET${colors.reset}`);
      console.log(`    → ${config.description}`);
      hasWarnings = true;
    } else {
      console.log(`  ${colors.green}✓${colors.reset} ${varName}`);
    }
  }

  // Check for weak secrets in production
  if (env.NODE_ENV === 'production') {
    console.log(`\n${colors.blue}Security Checks:${colors.reset}`);
    
    const weakSecrets = [
      'change-me-in-production',
      'another-strong-random-string',
      'super-secret',
    ];

    for (const secret of weakSecrets) {
      const found = Object.entries(env).filter(([key, value]) => 
        key.includes('SECRET') && value.includes(secret)
      );

      if (found.length > 0) {
        console.log(`  ${colors.red}✗${colors.reset} Weak secret detected in ${found[0][0]}`);
        hasErrors = true;
      }
    }

    if (!hasErrors) {
      console.log(`  ${colors.green}✓${colors.reset} No weak secrets detected`);
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(50));
  if (hasErrors) {
    console.log(`${colors.red}❌ environment variables Validation failed!${colors.reset}`);
    console.log('\nPlease fix the errors above before proceeding.');
    return false;
  } else if (hasWarnings) {
    console.log(`${colors.yellow}⚠️  Validation passed with warnings${colors.reset}`);
    console.log('\nConsider setting the recommended variables for better functionality.');
    return true;
  } else {
    console.log(`${colors.green}✅ All environment variables are valid!${colors.reset}`);
    return true;
  }
}

// Main execution
try {
  const env = loadEnv();
  const isValid = validateEnv(env);
  process.exit(isValid ? 0 : 1);
} catch (error) {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  process.exit(1);
}

