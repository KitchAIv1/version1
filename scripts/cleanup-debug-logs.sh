#!/bin/bash

# Production Debug Cleanup Script for KitchAI v2
# Removes debug-level logging statements while preserving error/warn logs
# Run this script after beta testing completion before production deployment

set -e

echo "🧹 KitchAI v2 - Production Debug Cleanup"
echo "========================================"

# Create backup
echo "📦 Creating backup of current state..."
git add .
git commit -m "Pre-cleanup backup: debug statements preserved for beta" || echo "No changes to commit"

# Remove debug-level log statements
echo "🔧 Removing debug-level log statements..."

# Remove .debug() calls but preserve .error(), .warn(), .info()
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i.bak 's/.*\.debug(.*);*//g'

# Remove logPerformanceMetric calls (beta-only)
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i.bak '/logPerformanceMetric/d'

# Remove logBetaEvent calls (beta-only)
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i.bak '/logBetaEvent/d'

# Remove any remaining console.log statements with debug indicators
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i.bak '/console\.log.*🔍\|console\.log.*DEBUG\|console\.log.*🚨/d'

# Clean up backup files
find src -name "*.bak" -delete

echo "✅ Debug cleanup completed"

# Validate TypeScript compilation
echo "🔍 Validating TypeScript compilation..."
if npx tsc --noEmit; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed - rolling back"
    git checkout HEAD~1 -- src/
    exit 1
fi

echo "🚀 Production cleanup completed successfully"
echo "   - Debug logs removed"
echo "   - Error/warn logs preserved"
echo "   - TypeScript compilation verified"
echo ""
echo "Ready for production deployment! 🎉" 