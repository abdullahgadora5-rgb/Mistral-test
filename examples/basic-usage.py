#!/usr/bin/env python3
"""
Basic usage example for Obscura Browser MCP

This example demonstrates how to use Obscura's MCP server
with Python to perform web browsing tasks.

Requirements:
    - Obscura binary installed (see scripts/install-obscura.sh)
    - mcp Python package: pip install mcp
"""

import asyncio
import subprocess
import sys


async def main():
    """Example: Navigate to a page and extract data"""
    
    # Start Obscura MCP server as a subprocess
    # Note: The mcp Python package will handle this automatically
    # when you pass command="obscura" and args=["mcp"]
    
    try:
        from mcp import Client
    except ImportError:
        print("Error: mcp package not installed. Run: pip install mcp")
        sys.exit(1)
    
    # Connect to Obscura MCP server
    print("Connecting to Obscura MCP server...")
    client = Client(command="obscura", args=["mcp"])
    
    try:
        # Start the server
        await client.start()
        
        # Example 1: Navigate to a page
        print("\n1. Navigating to example.com...")
        result = await client.call_tool(
            "browser_navigate",
            {"url": "https://example.com"}
        )
        print(f"   Navigation result: {result}")
        
        # Example 2: Get page snapshot
        print("\n2. Getting page snapshot...")
        snapshot = await client.call_tool("browser_snapshot", {})
        print(f"   URL: {snapshot.get('url', 'N/A')}")
        print(f"   Title: {snapshot.get('title', 'N/A')}")
        print(f"   Text preview: {snapshot.get('text', '')[:200]}...")
        
        # Example 3: Extract specific elements
        print("\n3. Extracting all links...")
        links = await client.call_tool(
            "browser_extract",
            {"selector": "a", "attribute": "href", "all": True}
        )
        print(f"   Found {len(links)} links")
        for link in links[:5]:  # Show first 5
            print(f"   - {link}")
        
        # Example 4: Take a screenshot
        print("\n4. Taking screenshot...")
        screenshot = await client.call_tool(
            "browser_screenshot",
            {"path": "/tmp/example-screenshot.png"}
        )
        print(f"   Screenshot saved to: {screenshot.get('path', 'N/A')}")
        
        # Example 5: Generate PDF
        print("\n5. Generating PDF...")
        pdf = await client.call_tool(
            "browser_pdf",
            {"path": "/tmp/example-page.pdf"}
        )
        print(f"   PDF saved to: {pdf.get('path', 'N/A')}")
        
        # Example 6: Get cookies
        print("\n6. Getting cookies...")
        cookies = await client.call_tool("browser_get_cookies", {})
        print(f"   Found {len(cookies)} cookies")
        
    except Exception as e:
        print(f"\nError: {e}")
        print("\nMake sure Obscura is installed and accessible in your PATH.")
        print("Run: ./scripts/install-obscura.sh")
    finally:
        # Clean up
        await client.close()
        print("\nDisconnected from Obscura MCP server.")


if __name__ == "__main__":
    asyncio.run(main())
