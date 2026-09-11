#!/bin/bash

# Install Obscura Browser MCP
# This script downloads and installs the Obscura binary

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

# Map architecture
case "$ARCH" in
    x86_64) ARCH="x64" ;;
    aarch64) ARCH="arm64" ;;
    *) 
        echo -e "${RED}Unsupported architecture: $ARCH${NC}"
        echo "Obscura currently supports x86_64 and ARM64"
        exit 1
        ;;
esac

# Map OS
case "$OS" in
    linux) OS="linux" ;;
    darwin) OS="macos" ;;
    *) 
        echo -e "${RED}Unsupported OS: $OS${NC}"
        echo "Obscura currently supports Linux and macOS"
        exit 1
        ;;
esac

# Default version (check for latest at https://github.com/h4ckf0r0day/obscura/releases)
VERSION="v0.5.0"

# Build filename
FILENAME="obscura-${VERSION}-${OS}-${ARCH}.tar.gz"
URL="https://github.com/h4ckf0r0day/obscura/releases/download/${VERSION}/${FILENAME}"

# Temporary directory
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

echo -e "${YELLOW}Installing Obscura ${VERSION} for ${OS}-${ARCH}...${NC}"
echo "Download URL: $URL"
echo ""

# Download
echo -e "${YELLOW}Downloading...${NC}"
curl -L -o "$TMP_DIR/$FILENAME" "$URL" || {
    echo -e "${RED}Failed to download Obscura${NC}"
    exit 1
}

# Extract
echo -e "${YELLOW}Extracting...${NC}"
tar -xzf "$TMP_DIR/$FILENAME" -C "$TMP_DIR" || {
    echo -e "${RED}Failed to extract Obscura${NC}"
    exit 1
}

# Install
BINARY="$TMP_DIR/obscura"
if [ -f "$BINARY" ]; then
    echo -e "${YELLOW}Installing binary to /usr/local/bin...${NC}"
    sudo chmod +x "$BINARY"
    sudo mv "$BINARY" /usr/local/bin/obscura || {
        echo -e "${RED}Failed to install Obscura${NC}"
        exit 1
    }
else
    echo -e "${RED}Obscura binary not found in archive${NC}"
    exit 1
fi

# Verify
if command -v obscura &> /dev/null; then
    echo -e "${GREEN}Obscura installed successfully!${NC}"
    echo ""
    echo "Version:"
    obscura --version
    echo ""
    echo "Available commands:"
    echo "  obscura mcp              - Start MCP server (stdio)"
    echo "  obscura mcp --stealth    - Start MCP server with stealth mode"
    echo "  obscura serve --mcp      - Start MCP server (HTTP)"
    echo ""
    echo -e "${GREEN}You can now use Obscura with MCP clients like Claude Desktop!${NC}"
else
    echo -e "${RED}Installation failed. Please check if /usr/local/bin is in your PATH${NC}"
    exit 1
fi
