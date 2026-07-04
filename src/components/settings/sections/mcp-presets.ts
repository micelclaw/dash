/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

// ─── MCP connection catalog (§B2) ───────────────────────────────────
// Curated presets so an admin adds a common MCP server in one click with
// a MINIMAL suggested tool allowlist (least-privilege by default) instead
// of hand-writing JSON. All values are templates — the admin reviews and
// fills any secret before saving.

export interface McpPreset {
  slug: string;
  name: string;
  /** Icon key mapped to a Lucide icon in the section. */
  icon: 'github' | 'folder' | 'browser' | 'book' | 'slack' | 'database';
  blurb: string;
  transport: 'http' | 'stdio';
  url?: string;
  command?: string;
  args?: string[];
  headers?: Record<string, string>;
  env?: Record<string, string>;
  /** Pre-filled `tool_filter.include` (the safe minimal set). */
  suggested_include?: string[];
}

export const MCP_PRESETS: McpPreset[] = [
  {
    slug: 'github',
    name: 'GitHub',
    icon: 'github',
    blurb: 'Issues, PRs and repos over HTTP.',
    transport: 'http',
    url: 'https://api.githubcopilot.com/mcp/',
    headers: { Authorization: 'Bearer <your-token>' },
    suggested_include: ['create_issue', 'list_issues', 'get_pull_request', 'list_pull_requests'],
  },
  {
    slug: 'filesystem',
    name: 'Filesystem',
    icon: 'folder',
    blurb: 'Read and list files via a stdio server.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/srv/share'],
    suggested_include: ['read_file', 'list_directory'],
  },
  {
    slug: 'playwright',
    name: 'Playwright',
    icon: 'browser',
    blurb: 'Drive a browser, take screenshots.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@playwright/mcp@latest'],
    suggested_include: ['browser_navigate', 'browser_click', 'browser_snapshot'],
  },
  {
    slug: 'context7',
    name: 'Context7',
    icon: 'book',
    blurb: 'Fetch up-to-date library docs.',
    transport: 'http',
    url: 'https://mcp.context7.com/mcp',
    suggested_include: ['resolve-library-id', 'get-library-docs'],
  },
  {
    slug: 'slack',
    name: 'Slack',
    icon: 'slack',
    blurb: 'Post messages, read channels.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    env: { SLACK_BOT_TOKEN: '', SLACK_TEAM_ID: '' },
    suggested_include: ['slack_post_message', 'slack_list_channels'],
  },
  {
    slug: 'postgres',
    name: 'Postgres',
    icon: 'database',
    blurb: 'Run read-only SQL queries.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://user:pass@host/db'],
    suggested_include: ['query'],
  },
];
