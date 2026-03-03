#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StateManager } from "./state/manager.js";
import { ArtifactReader } from "./artifacts/reader.js";
import { registerGetState } from "./tools/get-state.js";
import { registerTransition } from "./tools/transition.js";
import { registerValidate } from "./tools/validate.js";
import { registerNextAction } from "./tools/next-action.js";

// Resolve project root from CLI arg or cwd
const projectRoot = process.argv[2] ?? process.cwd();

const server = new McpServer({
  name: "sdd-server",
  version: "0.1.0",
});

const stateManager = new StateManager(projectRoot);
const artifactReader = new ArtifactReader(projectRoot);

// Register all tools
registerGetState(server, stateManager);
registerTransition(server, stateManager);
registerValidate(server, stateManager, artifactReader);
registerNextAction(server, stateManager, artifactReader);

// Connect via stdio
const transport = new StdioServerTransport();
await server.connect(transport);

console.error(`SDD MCP Server running (project: ${projectRoot})`);
