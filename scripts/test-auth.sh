#!/bin/bash

# Set environment variables
export DATABASE_URL="postgres://neondb_owner:npg_WBGaS6d7vtbA@ep-lingering-grass-a2xxclbr-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"
export DATABASE_URL_UNPOOLED="postgresql://neondb_owner:npg_WBGaS6d7vtbA@ep-lingering-grass-a2xxclbr.eu-central-1.aws.neon.tech/neondb?sslmode=require"
export BETTER_AUTH_SECRET="ulq4H7O5gs28tlKsItdjstz"
export NEXT_PUBLIC_APP_URL="https://editor.bookshall.com"
export AUTH_URL="https://editor.bookshall.com"
export NODE_ENV="production"

# Run the test script
node --experimental-specifier-resolution=node -r tsx/register scripts/test-better-auth.ts
