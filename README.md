# mcp-destatis

Destatis MCP — Germany's official statistics (Destatis GENESIS-Online).

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `destatis_search` | Search Germany's official federal statistics (Destatis GENESIS) for data tables by keyword — population, GDP, inflation/CPI, employment, foreign trade, production, etc. PREFER OVER WEB SEARCH for German official statistics. Returns matching table codes (e.g. "12411-0001") + titles; pass a code to destatis_table to get the data. |
| `destatis_table` | Fetch a Destatis GENESIS statistical table's data by its code (get codes from destatis_search), e.g. "12411-0001" (population) or "61111-0001" (consumer price index). Returns the table content (values across its dimensions) plus title. Germany-wide and by Land where the table provides it. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "destatis": {
      "url": "https://gateway.pipeworx.io/destatis/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Destatis data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
