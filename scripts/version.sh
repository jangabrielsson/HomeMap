#!/bin/bash

# HC3 QuickApp Manager - Version Release Script
# Updates version numbers and pushes to GitHub

set -e  # Exit on error

# Change to project root (parent of scripts directory)
cd "$(dirname "$0")/.."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║ HC3 QuickApp Manager - Version Manager║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if git working directory is clean
if [[ -n $(git status -s) ]]; then
    echo -e "${RED}✗ Error: Working directory is not clean!${NC}"
    echo -e "${YELLOW}Please commit or stash all changes before creating a new version.${NC}"
    echo ""
    echo "Uncommitted changes:"
    git status -s
    exit 1
fi

echo -e "${GREEN}✓ Working directory is clean${NC}"
echo ""

# Get current version from tauri.conf.json
CURRENT_VERSION=$(grep -o '"version": *"[^"]*"' src-tauri/tauri.conf.json | grep -o '"[0-9.]*"' | tr -d '"')
echo -e "Current version: ${BLUE}${CURRENT_VERSION}${NC}"
echo ""

# Prompt for new version
echo -e "${YELLOW}Enter new version number (e.g., 0.2.0, 1.0.0):${NC}"
read -p "> " NEW_VERSION

# Validate version format (basic semver check)
if ! [[ $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}✗ Error: Invalid version format. Use semantic versioning (e.g., 0.2.0)${NC}"
    exit 1
fi

# Confirm version update
echo ""
echo -e "Version will be updated: ${BLUE}${CURRENT_VERSION}${NC} → ${GREEN}${NEW_VERSION}${NC}"
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Version update cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}Updating version numbers...${NC}"

# Update version in tauri.conf.json
sed -i '' "s/\"version\": \"${CURRENT_VERSION}\"/\"version\": \"${NEW_VERSION}\"/" src-tauri/tauri.conf.json
echo -e "${GREEN}✓${NC} Updated src-tauri/tauri.conf.json"

# Update version in Cargo.toml
sed -i '' "s/^version = \"${CURRENT_VERSION}\"/version = \"${NEW_VERSION}\"/" src-tauri/Cargo.toml
echo -e "${GREEN}✓${NC} Updated src-tauri/Cargo.toml"

# Update Cargo.lock if it exists
if [ -f "src-tauri/Cargo.lock" ]; then
    cd src-tauri
    cargo update --workspace
    cd ..
    echo -e "${GREEN}✓${NC} Updated src-tauri/Cargo.lock"
fi

echo ""
echo -e "${BLUE}Creating git commit and tag...${NC}"

# Commit changes
git add src-tauri/tauri.conf.json src-tauri/Cargo.toml
if [ -f "src-tauri/Cargo.lock" ]; then
    git add src-tauri/Cargo.lock
fi

git commit -m "chore: bump version to ${NEW_VERSION}"
echo -e "${GREEN}✓${NC} Created commit"

# Create git tag
git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}"
echo -e "${GREEN}✓${NC} Created tag v${NEW_VERSION}"

echo ""
echo -e "${BLUE}Pushing to GitHub...${NC}"

# Push commit and tags
git push origin main
git push origin "v${NEW_VERSION}"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        Version ${NEW_VERSION} Released! 🎉        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "Commit and tag pushed to GitHub"
echo -e "Tag: ${BLUE}v${NEW_VERSION}${NC}"
echo ""
echo -e "${YELLOW}📦 GitHub Actions will now build the release:${NC}"
echo -e "   • macOS (Apple Silicon)"
echo -e "   • macOS (Intel)"
echo -e "   • Windows"
echo ""
echo -e "Check progress at: ${BLUE}https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions${NC}"
echo ""
