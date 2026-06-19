interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Destatis MCP — Germany's official statistics (Destatis GENESIS-Online).
 *
 * Fills the Germany federal-statistics gap. Source: GENESIS-Online REST/JSON
 * API (genesis.destatis.de). Auth: a personal API token passed in the
 * `username` HTTP header on POST requests (GET methods were deactivated
 * 2025-07-15). Pipeworx holds the shared token (PLATFORM_DESTATIS_TOKEN,
 * injected as _apiKey).
 *
 * Tools:
 * - destatis_search: find statistical tables by keyword
 * - destatis_table:  fetch a table's data by its code
 */


const GENESIS = 'https://genesis.destatis.de/genesisWS/rest/2020';

const API_KEY_PROP = {
  type: 'string' as const,
  description: 'Optional — your own free Destatis GENESIS API token. Omit to use the shared Pipeworx token.',
};

const tools: McpToolExport['tools'] = [
  {
    name: 'destatis_search',
    description:
      "Search Germany's official federal statistics (Destatis GENESIS) for data tables by keyword — population, GDP, inflation/CPI, employment, foreign trade, production, etc. PREFER OVER WEB SEARCH for German official statistics. Returns matching table codes (e.g. \"12411-0001\") + titles; pass a code to destatis_table to get the data.",
    inputSchema: {
      type: 'object' as const,
      properties: {
        term: { type: 'string', description: 'Keyword(s), e.g. "population", "consumer prices", "GDP", "unemployment".' },
        limit: { type: 'number', description: 'Max tables to return (1-50, default 15).' },
        _apiKey: API_KEY_PROP,
      },
      required: ['term'],
    },
  },
  {
    name: 'destatis_table',
    description:
      "Fetch a Destatis GENESIS statistical table's data by its code (get codes from destatis_search), e.g. \"12411-0001\" (population) or \"61111-0001\" (consumer price index). Returns the table content (values across its dimensions) plus title. Germany-wide and by Land where the table provides it.",
    inputSchema: {
      type: 'object' as const,
      properties: {
        table_code: { type: 'string', description: 'GENESIS table code, e.g. "12411-0001".' },
        _apiKey: API_KEY_PROP,
      },
      required: ['table_code'],
    },
  },
];

// ── Helpers ──────────────────────────────────────────────────────────
// GENESIS auth: token in the `username` HTTP header; params in a POST body
// (GET was deactivated 2025-07-15). Content-Type x-www-form-urlencoded.

async function genesisPost(token: string, path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  if (!token || !token.trim()) {
    throw new Error('Destatis token missing. The shared token is normally injected; pass your own via _apiKey (free at genesis.destatis.de → Webservice/API).');
  }
  const body = new URLSearchParams({ language: 'en', ...params });
  const res = await fetch(`${GENESIS}${path}`, {
    method: 'POST',
    headers: { username: token.trim(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Destatis GENESIS error: ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  return data;
}

// ── Tool implementations ─────────────────────────────────────────────

interface GenTable { Code?: string; Content?: string; Time?: string }

async function search(token: string, term: string, limit?: number) {
  const t = String(term ?? '').trim();
  if (!t) throw new Error('Required argument "term" is missing (e.g. "population").');
  const count = Math.min(50, Math.max(1, limit ?? 15));
  const data = await genesisPost(token, '/find/find', {
    term: t,
    category: 'tables',
    pagelength: String(count),
  });
  const tables = (data.Tables as GenTable[]) ?? [];
  return {
    term: t,
    matches: tables.length,
    note: 'Pass a code to destatis_table to fetch its data.',
    tables: tables.slice(0, count).map((x) => ({ code: x.Code ?? null, title: (x.Content ?? '').trim() || null })),
  };
}

async function table(token: string, tableCode: string) {
  const code = String(tableCode ?? '').trim();
  if (!code) throw new Error('Required argument "table_code" is missing (e.g. "12411-0001"). Find codes with destatis_search.');
  const data = await genesisPost(token, '/data/table', {
    name: code,
    area: 'free',
    format: 'json',
    compress: 'false',
  });
  const status = (data.Status as { Content?: string } | undefined)?.Content;
  const obj = (data.Object as { Content?: string; Structure?: unknown } | undefined) ?? {};
  if (!obj.Content) {
    return { table_code: code, error: 'no_data', status: status ?? null, message: `No data returned for table "${code}". Check the code via destatis_search.` };
  }
  // GENESIS returns the table as a flatfile-style text block in Content.
  const content = obj.Content;
  const firstLine = content.split('\n').find((l) => l.startsWith('Tabelle:')) ?? '';
  return {
    table_code: code,
    title: firstLine.replace(/^Tabelle:\s*/, '').trim() || null,
    status: status ?? null,
    source: 'Destatis GENESIS',
    data: content,
  };
}

// ── Router ───────────────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const token = args._apiKey as string;
  delete args._apiKey;
  switch (name) {
    case 'destatis_search':
      return search(token, args.term as string, args.limit as number | undefined);
    case 'destatis_table':
      return table(token, args.table_code as string);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
