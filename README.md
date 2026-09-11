# Obscura Browser MCP

This repository provides web browsing capability through the [Obscura](https://github.com/h4ckf0r0day/obscura) headless browser using the Model Context Protocol (MCP).

## What is Obscura?

Obscura is a lightweight, high-performance headless browser engine written in Rust, specifically designed for web scraping and AI agent automation. It includes native MCP server support, allowing AI agents to control browser sessions directly.

## Setup

### Prerequisites

1. **Install Obscura**: Download the pre-built binary from [Obscura releases](https://github.com/h4ckf0r0day/obscura/releases)
   - Linux: `obscura-v0.5.0-linux-x64.tar.gz`
   - macOS: `obscura-v0.5.0-macos-x64.tar.gz`
   - Windows: `obscura-v0.5.0-windows-x64.zip`

2. **Extract and add to PATH**:
   ```bash
   tar -xzf obscura-*.tar.gz
   chmod +x obscura
   sudo mv obscura /usr/local/bin/
   ```

### Running the MCP Server

Obscura includes a built-in MCP server. Run it with:

```bash
obscura mcp
```

This starts the MCP server using stdio transport (default), which works with Claude Desktop, Cursor, and other MCP clients that launch subprocesses.

#### Alternative: HTTP Transport

For remote access or HTTP-based MCP clients:

```bash
obscura serve --mcp --port 9222
```

This starts both the CDP server and MCP server on port 9222.

### With Stealth Mode

Enable anti-detection features:

```bash
obscura mcp --stealth
```

## MCP Tools Available

The Obscura MCP server exposes these tools:

- **`browser_navigate`**: Navigate to a URL
- **`browser_click`**: Click an element
- **`browser_fill`**: Fill a form input
- **`browser_extract`**: Extract data from the page
- **`browser_snapshot`**: Get current page snapshot (URL, title, text, elements)
- **`browser_get_cookies`**: Get cookies for the current page
- **`browser_set_cookie`**: Set a cookie
- **`browser_clear_cookies`**: Clear cookies
- **`browser_intercept`**: Intercept network requests
- **`browser_screenshot`**: Take a screenshot (PNG)
- **`browser_pdf`**: Generate a PDF of the page

## Usage Examples

### With Claude Desktop

1. Install Obscura binary (as above)
2. In Claude Desktop settings, add Obscura as an MCP server:
   ```json
   {
     "command": "obscura",
     "args": ["mcp", "--stealth"]
   }
   ```
3. Restart Claude Desktop
4. Use tools like: "Visit https://example.com and extract all links"

### With MCP Client Libraries

#### Python (using mcp client)

```python
import asyncio
from mcp import Client

async def main():
    # Connect to Obscura MCP server
    client = Client(command="obscura", args=["mcp"])
    
    # Navigate to a page
    await client.call_tool("browser_navigate", {"url": "https://example.com"})
    
    # Get page snapshot
    result = await client.call_tool("browser_snapshot", {})
    print(result)
    
    await client.close()

asyncio.run(main())
```

#### JavaScript/TypeScript

```javascript
import { McpClient } from '@modelcontextprotocol/sdk';

const client = new McpClient({
  command: 'obscura',
  args: ['mcp']
});

// Navigate and extract
const result = await client.callTool('browser_navigate', { url: 'https://example.com' });
const snapshot = await client.callTool('browser_snapshot', {});
console.log(snapshot);
```

## Configuration Options

### Environment Variables

- `OBSCURA_MCP_ALLOWED_ORIGINS`: Comma-separated list of allowed origins for HTTP transport
- `OBSCURA_MCP_TIMEOUT`: Request timeout in seconds (default: 30)

### Command Line Flags

```bash
obscura mcp [OPTIONS]

Options:
  --stealth              Enable stealth mode (anti-detection)
  --port <PORT>          Port for HTTP transport (default: 9222)
  --host <HOST>          Host to bind to (default: 127.0.0.1)
  --timeout <SECONDS>    Request timeout
  --verbose              Enable verbose logging
  --help                 Show help
```

## Docker (Optional)

Run Obscura MCP in Docker:

```bash
docker run -it --rm \
  -p 9222:9222 \
  ghcr.io/h4ckf0r0day/obscura:latest \
  obscura serve --mcp --port 9222 --host 0.0.0.0
```

## Resources

- [Obscura Documentation](https://docs.obscura.sh)
- [Obscura GitHub](https://github.com/h4ckf0r0day/obscura)
- [MCP Specification](https://github.com/modelcontextprotocol/specification)

## License

This repository configuration is provided as-is. Obscura is licensed under MIT License.
