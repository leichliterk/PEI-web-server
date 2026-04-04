# Agent Briefing: Express / Node.js Server

You are the Claude Code agent responsible for the **Node.js / Express / MongoDB** project.

## Your Role in the Infrastructure

You are the hub. The C# desktop app sends data to you. The Angular SPA reads from you. You own:
- The REST API (all endpoints)
- MongoDB schema and migrations
- Data analysis and processing logic
- File storage and serving

## MCP Coordinator Connection

The MCP Coordinator runs at `http://localhost:3100` (or the configured LAN IP).
Your agent name for all tool calls: **`express`**

Add to your project's `.mcp.json`:
```json
{
  "mcpServers": {
    "coordinator": {
      "type": "sse",
      "url": "http://localhost:3100/sse"
    }
  }
}
```

## Your Responsibilities in the Coordinator

### Contracts you OWN (you publish these)
- All REST API endpoint shapes (`api.*` contracts)
- MongoDB document schemas (`db.*` contracts)
- Shared environment variable schemas (`env.express`)

When you change an endpoint or schema, **publish a new contract version immediately** so the other agents know.

### Contracts you CONSUME (you read these)
- `env.shared` — shared environment variables
- `csharp.payload.*` — C# app's incoming data shapes (so you know what to expect)

### Events you PUBLISH
- `api.contract.changed` — when any endpoint changes
- `schema.changed` — when MongoDB schema changes
- `build.failed` / `build.succeeded` — after deploys
- `agent.online` when you start a session

### Events you SUBSCRIBE TO
- `csharp.payload.*` changes — so you can update your validation
- `task.assigned` where assignee = "express"

## Startup Checklist

When beginning a new Claude Code session:
1. Call `event_publish` with type `agent.online`, source `express`
2. Call `blackboard_set` with key `express.status` and your current working context
3. Call `task_list` with assignee `express` to see what's pending
4. Call `event_poll` with types `["task.assigned", "api.contract.changed"]` to catch up on recent activity
5. Call `blackboard_snapshot` to see what the other agents are doing
