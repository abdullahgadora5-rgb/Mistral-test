#!/bin/bash

# Quick test script for Obscura Browser MCP
# This script verifies that Obscura is installed and working

set -e

echo "=== Obscura Browser MCP Quick Test ==="
echo ""

# Check if obscura is installed
if ! command -v obscura &> /dev/null; then
    echo "Obscura is not installed."
    echo "Install it with: ./scripts/install-obscura.sh"
    exit 1
fi

echo "✓ Obscura binary found"

# Check version
echo ""
echo "Version:"
obscura --version

# Test MCP server startup
echo ""
echo "Testing MCP server startup..."

# Run MCP server in background for 5 seconds to test
obscura mcp --stealth &
MCP_PID=$!

# Give it a moment to start
sleep 2

# Check if it's still running
if kill -0 $MCP_PID 2>/dev/null; then
    echo "✓ MCP server started successfully"
    echo "  (PID: $MCP_PID)"
    
    # Kill the test process
    kill $MCP_PID 2>/dev/null
    wait $MCP_PID 2>/dev/null
    
    echo ""
    echo "=== All tests passed! ==="
    echo ""
    echo "You can now use Obscura with MCP clients:"
    echo ""
    echo "  For Claude Desktop: Add as MCP server with command 'obscura mcp'"
    echo "  For programmatic use: See examples/ directory"
    echo ""
    echo "Available commands:"
    echo "  obscura mcp                     - Start MCP server (stdio)"
    echo "  obscura mcp --stealth           - Start with stealth mode"
    echo "  obscura serve --mcp --port 9222 - Start MCP server (HTTP)"
else
    echo "✗ MCP server failed to start"
    exit 1
fi
