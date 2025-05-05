import express from 'express';
import type { Request, Response } from 'express';
import { config } from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerRestApi } from "./restApi.js";
import { registerTools } from "./tools.js";

// Load and verify environment variables
config();

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;
const PATH = "/mcp";

registerRestApi(app);

function getServer(): McpServer {
  const server = new McpServer({ name: "jira-mcp-server", version: "1.0.0" });
  registerTools(server);
  return server;
}

app.post(PATH, async (req: Request, res: Response) => {
  try {
    const server = getServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP Error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null
      });
    }
  }
});

app.get(PATH, async (req: Request, res: Response) => {

  try {
    const server = getServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    // Keep the connection alive
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000);

    res.on('close', () => {
      clearInterval(keepAlive);
      transport.close();
      server.close();
    });

    await server.connect(transport);

    // Handle transport messages
    const handleMessage = (message: any) => {
      res.write(`data: ${JSON.stringify(message)}\n\n`);
    };
    transport.onmessage = handleMessage;

    // Let the transport handle the request (this will set headers and manage the SSE protocol)
    await transport.handleRequest(req, res, {});

  } catch (error) {
    console.error("MCP Error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null
      });
    }
  }
});

// Store transports for each session
const sseTransports: Record<string, SSEServerTransport> = {};

// Legacy SSE endpoint for older clients
app.get('/sse', async (req: Request, res: Response) => {
  const server = getServer();
  const transport = new SSEServerTransport('/messages', res);

  // Store the transport by sessionId
  sseTransports[transport.sessionId] = transport;

  // Add keepalive
  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 30000);

  res.on("close", () => {
    clearInterval(keepAlive);
    delete sseTransports[transport.sessionId];
    transport.close();
    server.close();
  });

  await server.connect(transport);
});

// Legacy message endpoint for older clients
app.post('/messages', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = sseTransports[sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).send('No transport found for sessionId');
  }
});

app.listen(PORT, () => {
  console.log(`✅ Jira MCP server listening at http://localhost:${PORT}`);
});
