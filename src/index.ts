import express, { Request, Response } from "express";
import { config } from "dotenv";
import axios from "axios";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

config();

const JIRA_BASE = `https://${process.env.JIRA_DOMAIN}`;
const AUTH_HEADER = {
  Authorization: `Basic ${Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString("base64")}`,
  Accept: "application/json",
  "Content-Type": "application/json"
};

function getServer(): McpServer {
  const server = new McpServer({ name: "jira-mcp-server", version: "1.0.0" });

  server.tool("getAssignedIssues", {}, { description: "Get Jira issues assigned to the current user" }, async () => {
    const jql = `assignee = currentUser() ORDER BY updated DESC`;
    const response = await axios.get(`${JIRA_BASE}/rest/api/3/search`, {
      headers: AUTH_HEADER,
      params: { jql, maxResults: 5, fields: "summary,status" }
    });

    // @ts-ignore
    const issues = response.data.issues.map((issue) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name
    }));

    return {
      content: [
        {
          type: "text",
          // @ts-ignore
          text: issues.map((i) => `${i.key}: ${i.summary} [${i.status}]`).join("\n")
        }
      ]
    };
  });

  server.tool("getIssueByKey", {
    issueKey: z.string()
  }, { description: "Fetch a specific Jira issue by its key" }, async ({ issueKey }) => {
    const response = await axios.get(`${JIRA_BASE}/rest/api/3/issue/${issueKey}`, {
      headers: AUTH_HEADER,
      params: { fields: "summary,description,status,assignee,reporter,priority,comment,project" }
    });

    const fields = response.data.fields;

    return {
      content: [
        {
          type: "text",
          text: `${issueKey}: ${fields.summary}\nStatus: ${fields.status.name}\nAssignee: ${fields.assignee?.displayName || "Unassigned"}\nPriority: ${fields.priority?.name || "None"}\nProject: ${fields.project.name}`
        }
      ]
    };
  });

  server.tool("transitionIssue", {
    issueKey: z.string(),
    transitionName: z.string()
  }, { description: "Transition a Jira issue to a new status" }, async ({ issueKey, transitionName }) => {
    const transitions = await axios.get(`${JIRA_BASE}/rest/api/3/issue/${issueKey}/transitions`, {
      headers: AUTH_HEADER
    });

    // @ts-ignore
    const match = transitions.data.transitions.find((t) => t.name.toLowerCase() === transitionName.toLowerCase());

    if (!match) {
      return { content: [{ type: "text", text: `Transition "${transitionName}" not found.` }] };
    }

    await axios.post(`${JIRA_BASE}/rest/api/3/issue/${issueKey}/transitions`, {
      transition: { id: match.id }
    }, { headers: AUTH_HEADER });

    return {
      content: [{ type: "text", text: `Issue ${issueKey} transitioned to "${transitionName}".` }]
    };
  });

  server.tool("assignIssue", {
    issueKey: z.string(),
    accountId: z.string()
  }, { description: "Assign a Jira issue to a user by accountId" }, async ({ issueKey, accountId }) => {
    await axios.put(`${JIRA_BASE}/rest/api/3/issue/${issueKey}/assignee`, {
      accountId
    }, { headers: AUTH_HEADER });

    return {
      content: [{ type: "text", text: `Assigned ${issueKey} to account ${accountId}.` }]
    };
  });

  server.tool("linkToEpic", {
    issueKey: z.string(),
    epicKey: z.string()
  }, { description: "Link a Jira issue (like a Story) to an Epic" }, async ({ issueKey, epicKey }) => {
    await axios.put(`${JIRA_BASE}/rest/api/3/issue/${issueKey}`, {
      fields: {
        parent: { key: epicKey }
      }
    }, { headers: AUTH_HEADER });

    return {
      content: [{ type: "text", text: `Linked ${issueKey} to epic ${epicKey}.` }]
    };
  });

  server.tool("createIssue", {
    projectKey: z.string(),
    summary: z.string(),
    issueType: z.string().default("Task"),
    description: z.string().optional()
  }, { description: "Create a new Jira issue in a project" }, async ({ projectKey, summary, issueType, description }) => {
    const response = await axios.post(`${JIRA_BASE}/rest/api/3/issue`, {
      fields: {
        project: { key: projectKey },
        summary,
        description,
        issuetype: { name: issueType }
      }
    }, { headers: AUTH_HEADER });

    return {
      content: [{ type: "text", text: `Created issue ${response.data.key}: ${summary}` }]
    };
  });

  server.tool("updateIssue", {
    issueKey: z.string(),
    fields: z.record(z.string(), z.any())
  }, { description: "Update one or more fields on a Jira issue" }, async ({ issueKey, fields }) => {
    await axios.put(`${JIRA_BASE}/rest/api/3/issue/${issueKey}`, {
      fields
    }, { headers: AUTH_HEADER });

    return {
      content: [{ type: "text", text: `Updated issue ${issueKey} with provided fields.` }]
    };
  });

  return server;
}

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;
const PATH = "/mcp";

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

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Send initial connection message
    res.write('data: {"jsonrpc":"2.0","method":"connected","params":{}}\n\n');

    res.on("close", () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    
    // Handle SSE events
    transport.handleRequest(req, res, {}).catch((error) => {
      console.error("Transport error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null
        });
      }
    });

    // Keep the connection alive
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000);

    res.on('close', () => {
      clearInterval(keepAlive);
      transport.close();
      server.close();
    });

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

app.listen(PORT, () => {
  console.log(`✅ Jira MCP server listening at http://localhost:${PORT}${PATH}`);
});
