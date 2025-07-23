#!/bin/bash

# KitchAI v2 Security Check Script
# Prevents accidental exposure of confidential PRD documents
# Run this before any external sharing, audits, or deployments

set -e

echo "🔒 KitchAI v2 - Security Check for Confidential Documents"
echo "======================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track security violations
VIOLATIONS=0

echo -e "${BLUE}🔍 Scanning for confidential PRD documents...${NC}"

# Define sensitive patterns
SENSITIVE_PATTERNS=(
    "*PRD*.md"
    "*prd*.md"
    "KITCHAI_*_PRD_*.md"
    "*DASHBOARD_PRD*.md"
    "*SILICON_VALLEY_PRD*.md"
    "*CONFIDENTIAL*.md"
    "*INTERNAL*.md"
    "*BUSINESS_PLAN*.md"
    "*COMPETITIVE_ANALYSIS*.md"
    "*MARKETING_STRATEGY*.md"
    "*PRODUCT_STRATEGY*.md"
)

# Define exceptions - legitimate technical documents
LEGITIMATE_PATTERNS=(
    "BACKUP_STRATEGY.md"
    "*_TECHNICAL_STRATEGY.md"
    "*_DEPLOYMENT_STRATEGY.md"
    "*_CACHING_STRATEGY.md"
    "*_DATABASE_STRATEGY.md"
    "*_PERFORMANCE_STRATEGY.md"
)

# Check for files in repository
echo -e "${BLUE}📁 Checking repository files...${NC}"
for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    # Find files matching sensitive patterns
    found_files=$(find . -name "$pattern" -not -path "./node_modules/*" -not -path "./.git/*" 2>/dev/null)
    
    if [ -n "$found_files" ]; then
        # Check if any found files are legitimate (not in exceptions)
        for file in $found_files; do
            is_legitimate=false
            
            # Check against legitimate patterns
            for legit_pattern in "${LEGITIMATE_PATTERNS[@]}"; do
                if [[ "$(basename "$file")" == $legit_pattern ]]; then
                    is_legitimate=true
                    break
                fi
            done
            
            # If not legitimate, report as violation
            if [ "$is_legitimate" = false ]; then
                echo -e "${RED}❌ SECURITY VIOLATION: Found sensitive file: $file${NC}"
                VIOLATIONS=$((VIOLATIONS + 1))
            fi
        done
    fi
done

# Check git staging area
echo -e "${BLUE}📦 Checking git staging area...${NC}"
if git diff --cached --name-only | grep -E "(PRD|prd|CONFIDENTIAL|INTERNAL|STRATEGY)" 2>/dev/null; then
    echo -e "${RED}❌ SECURITY VIOLATION: Sensitive files are staged for commit${NC}"
    git diff --cached --name-only | grep -E "(PRD|prd|CONFIDENTIAL|INTERNAL|STRATEGY)"
    VIOLATIONS=$((VIOLATIONS + 1))
fi

# Check git history for sensitive files (last 10 commits)
echo -e "${BLUE}📚 Checking recent git history...${NC}"
if git log --name-only -10 --oneline | grep -E "(PRD|prd|CONFIDENTIAL|INTERNAL|STRATEGY)" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  WARNING: Sensitive files found in recent git history${NC}"
    echo -e "${YELLOW}   Consider using git filter-branch to remove them completely${NC}"
fi

# Check for sensitive content in files
echo -e "${BLUE}🔍 Scanning file contents for sensitive keywords...${NC}"
SENSITIVE_KEYWORDS=(
    "CONFIDENTIAL"
    "INTERNAL ONLY"
    "DO NOT SHARE"
    "PROPRIETARY"
    "STRATEGIC PLAN"
    "COMPETITIVE ADVANTAGE"
    "BUSINESS MODEL"
    "REVENUE PROJECTIONS"
    "FUNDING"
    "VALUATION"
)

for keyword in "${SENSITIVE_KEYWORDS[@]}"; do
    if grep -r "$keyword" . --include="*.md" --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null | grep -v "prd-archive" | grep -q .; then
        echo -e "${YELLOW}⚠️  Found sensitive keyword '$keyword' in:${NC}"
        grep -r "$keyword" . --include="*.md" --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null | grep -v "prd-archive" | head -3
    fi
done

# Validate .gitignore
echo -e "${BLUE}📋 Validating .gitignore configuration...${NC}"
if ! grep -q "prd-archive" .gitignore; then
    echo -e "${RED}❌ SECURITY VIOLATION: .gitignore missing PRD protection${NC}"
    VIOLATIONS=$((VIOLATIONS + 1))
fi

if ! grep -q "PRD.*\.md" .gitignore; then
    echo -e "${RED}❌ SECURITY VIOLATION: .gitignore missing PRD pattern protection${NC}"
    VIOLATIONS=$((VIOLATIONS + 1))
fi

# Check deployment readiness
echo -e "${BLUE}🚀 Checking deployment configuration...${NC}"

# Check if build scripts exclude sensitive files
if [ -f "package.json" ]; then
    if grep -q "prd\|PRD\|confidential" package.json 2>/dev/null; then
        echo -e "${YELLOW}⚠️  WARNING: package.json may reference sensitive files${NC}"
    fi
fi

# Check Expo configuration
if [ -f "app.json" ] || [ -f "app.config.js" ]; then
    echo -e "${GREEN}✅ Expo configuration found - checking for sensitive references...${NC}"
    
    # Check for actual sensitive content, not exclusion patterns
    if grep -q "prd\|PRD\|confidential" app.json app.config.js 2>/dev/null; then
        # Filter out legitimate exclusion patterns in assetBundlePatterns
        sensitive_lines=$(grep -v "assetBundlePatterns\|!" app.json app.config.js 2>/dev/null | grep -i "prd\|confidential")
        
        if [ -n "$sensitive_lines" ]; then
            echo -e "${RED}❌ SECURITY VIOLATION: Expo config contains sensitive references${NC}"
            echo "$sensitive_lines"
            VIOLATIONS=$((VIOLATIONS + 1))
        else
            echo -e "${GREEN}✅ Expo config only contains legitimate exclusion patterns${NC}"
        fi
    fi
fi

# Summary
echo ""
echo "🔒 Security Check Summary"
echo "========================"

if [ $VIOLATIONS -eq 0 ]; then
    echo -e "${GREEN}✅ SECURITY CHECK PASSED${NC}"
    echo -e "${GREEN}   No confidential documents detected in repository${NC}"
    echo -e "${GREEN}   Safe for external sharing and audits${NC}"
    echo ""
    echo -e "${BLUE}📋 Recommended Actions:${NC}"
    echo "   ✅ Repository is audit-ready"
    echo "   ✅ Safe for TestFlight deployment"
    echo "   ✅ Ready for external code review"
    exit 0
else
    echo -e "${RED}❌ SECURITY CHECK FAILED${NC}"
    echo -e "${RED}   Found $VIOLATIONS security violation(s)${NC}"
    echo -e "${RED}   DO NOT share repository externally${NC}"
    echo ""
    echo -e "${BLUE}📋 Required Actions:${NC}"
    echo "   1. Move sensitive files to secure platform (Notion, Confluence)"
    echo "   2. Update .gitignore to exclude sensitive patterns"
    echo "   3. Remove sensitive files from git history if needed"
    echo "   4. Re-run this security check"
    echo ""
    echo -e "${YELLOW}🛠️  Remediation Commands:${NC}"
    echo "   # Remove files from git tracking:"
    echo "   git rm --cached [sensitive-file.md]"
    echo ""
    echo "   # Remove from git history (DANGEROUS - backup first):"
    echo "   git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch [file]' --prune-empty --tag-name-filter cat -- --all"
    exit 1
fi 