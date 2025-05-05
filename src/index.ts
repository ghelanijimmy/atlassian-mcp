import express from 'express';
import type { Request, Response } from 'express';
import { config } from "dotenv";
import axios from "axios";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

// Load and verify environment variables
const result = config();
console.log('Dotenv config result:', result);
console.log('JIRA_DOMAIN:', process.env.JIRA_DOMAIN);
console.log('JIRA_EMAIL:', process.env.JIRA_EMAIL);
console.log('PORT:', process.env.PORT);

const JIRA_BASE = `https://${process.env.JIRA_DOMAIN}`;
const AUTH_HEADER = {
  Authorization: `Basic ${Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString("base64")}`,
  Accept: "application/json",
  "Content-Type": "application/json"
};

function getServer(): McpServer {
  const server = new McpServer({ name: "jira-mcp-server", version: "1.0.0" });

  // Shared helper for searching issues
  async function doJiraSearch({
    projectKey,
    assignee,
    issueType,
    maxResults = 20,
    startAt = 0,
    jql,
  }: {
    projectKey?: string;
    assignee?: string;
    issueType?: string;
    maxResults?: number;
    startAt?: number;
    jql?: string;
  }) {
    let jqlParts: string[] = [];
    if (jql) {
      jqlParts.push(jql);
    } else {
      if (projectKey) jqlParts.push(`project = '${projectKey}'`);
      if (assignee) jqlParts.push(`assignee = '${assignee}'`);
      if (issueType) jqlParts.push(`issuetype = '${issueType}'`);
    }
    const finalJql = jqlParts.length > 0 ? jqlParts.join(' AND ') : '';
    const requestBody: any = {
      jql: finalJql,
      maxResults,
      startAt,
      fields: ["*all"],
    };
    const response = await axios.post(
      `${JIRA_BASE}/rest/api/3/search`,
      requestBody,
      { headers: AUTH_HEADER }
    );
    const issues = response.data.issues;
    const total = response.data.total;
    const nextStart = startAt + maxResults;
    const isLast = nextStart >= total;
    return {
      issues,
      total,
      startAt,
      maxResults,
      isLast,
      nextPageToken: !isLast ? String(nextStart) : undefined,
    };
  }

  server.tool(
    "searchIssues",
    {
      projectKey: z.string().optional(),
      assignee: z.string().optional(),
      issueType: z.string().optional(),
      maxResults: z.number().optional().default(20),
      startAt: z.number().optional().default(0),
      jql: z.string().optional(),
    },
    { description: "Search Jira issues by project, assignee, type, or custom JQL. Returns all fields for each issue. Supports pagination." },
    async ({ projectKey, assignee, issueType, maxResults, startAt, jql }, _extra) => {
      const result = await doJiraSearch({ projectKey, assignee, issueType, maxResults, startAt, jql });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              issues: result.issues,
              total: result.total,
              startAt: result.startAt,
              maxResults: result.maxResults,
              isLast: result.isLast,
              nextPageToken: result.nextPageToken,
            }),
          },
        ],
        nextPageToken: result.nextPageToken,
      };
    }
  );

  server.tool(
    "getAssignedIssues",
    {
      maxResults: z.number().optional().default(5),
      nextPageToken: z.string().optional(),
    },
    { description: "Get Jira issues assigned to the current user. Use nextPageToken for pagination." },
    async ({ maxResults, nextPageToken }, _extra) => {
      const startAt = nextPageToken ? parseInt(nextPageToken, 10) : 0;
      const result = await doJiraSearch({ assignee: 'currentUser()', maxResults, startAt });
      const issues = result.issues.map((issue: any) => ({
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status?.name || '',
      }));
      let text = issues.map((i: any) => `${i.key}: ${i.summary} [${i.status}]`).join("\n");
      if (result.nextPageToken) {
        text += `\n\nnextPageToken: ${result.nextPageToken}`;
      }
      return {
        content: [
          {
            type: "text" as const,
            text,
          },
        ],
        nextPageToken: result.nextPageToken,
      };
    }
  );

  server.tool(
    "getIssueByKey",
    { issueKey: z.string() },
    { description: "Fetch a specific Jira issue by its key" },
    async ({ issueKey }, _extra) => {
      const response = await axios.get(`${JIRA_BASE}/rest/api/3/issue/${issueKey}`, {
        headers: AUTH_HEADER,
        params: { fields: "summary,description,status,assignee,reporter,priority,comment,project" }
      });
      const fields = response.data.fields;
      return {
        content: [
          {
            type: "text" as const,
            text: `${issueKey}: ${fields.summary}\nStatus: ${fields.status.name}\nAssignee: ${fields.assignee?.displayName || "Unassigned"}\nPriority: ${fields.priority?.name || "None"}\nProject: ${fields.project.name}`
          }
        ]
      };
    }
  );

  server.tool(
    "transitionIssue",
    { issueKey: z.string(), transitionName: z.string() },
    { description: "Transition a Jira issue to a new status" },
    async ({ issueKey, transitionName }, _extra) => {
      const transitions = await axios.get(`${JIRA_BASE}/rest/api/3/issue/${issueKey}/transitions`, {
        headers: AUTH_HEADER
      });
      // @ts-ignore
      const match = transitions.data.transitions.find((t: any) => t.name.toLowerCase() === transitionName.toLowerCase());
      if (!match) {
        return { content: [{ type: "text" as const, text: `Transition "${transitionName}" not found.` }] };
      }
      await axios.post(`${JIRA_BASE}/rest/api/3/issue/${issueKey}/transitions`, {
        transition: { id: match.id }
      }, { headers: AUTH_HEADER });
      return {
        content: [{ type: "text" as const, text: `Issue ${issueKey} transitioned to "${transitionName}".` }]
      };
    }
  );

  server.tool(
    "assignIssue",
    { issueKey: z.string(), accountId: z.string() },
    { description: "Assign a Jira issue to a user by accountId" },
    async ({ issueKey, accountId }, _extra) => {
      await axios.put(`${JIRA_BASE}/rest/api/3/issue/${issueKey}/assignee`, {
        accountId
      }, { headers: AUTH_HEADER });
      return {
        content: [{ type: "text" as const, text: `Assigned ${issueKey} to account ${accountId}.` }]
      };
    }
  );

  server.tool(
    "linkToEpic",
    { issueKey: z.string(), epicKey: z.string() },
    { description: "Link a Jira issue (like a Story) to an Epic" },
    async ({ issueKey, epicKey }, _extra) => {
      await axios.put(`${JIRA_BASE}/rest/api/3/issue/${issueKey}`, {
        fields: {
          parent: { key: epicKey }
        }
      }, { headers: AUTH_HEADER });
      return {
        content: [{ type: "text" as const, text: `Linked ${issueKey} to epic ${epicKey}.` }]
      };
    }
  );

  server.tool(
    "createIssue",
    { projectKey: z.string(), summary: z.string(), issueType: z.string().default("Task"), description: z.string().optional() },
    { description: "Create a new Jira issue in a project" },
    async ({ projectKey, summary, issueType, description }, _extra) => {
      const response = await axios.post(`${JIRA_BASE}/rest/api/3/issue`, {
        fields: {
          project: { key: projectKey },
          summary,
          description,
          issuetype: { name: issueType }
        }
      }, { headers: AUTH_HEADER });
      return {
        content: [{ type: "text" as const, text: `Created issue ${response.data.key}: ${summary}` }]
      };
    }
  );

  server.tool(
    "updateIssue",
    { issueKey: z.string(), fields: z.record(z.string(), z.any()) },
    { description: "Update one or more fields on a Jira issue" },
    async ({ issueKey, fields }, _extra) => {
      await axios.put(`${JIRA_BASE}/rest/api/3/issue/${issueKey}`, {
        fields
      }, { headers: AUTH_HEADER });
      return {
        content: [{ type: "text" as const, text: `Updated issue ${issueKey} with provided fields.` }]
      };
    }
  );

  server.tool(
    "bulkEditIssues",
    {
      issueKeys: z.array(z.string()),
      fields: z.record(z.string(), z.any()),
      sendBulkNotification: z.boolean().optional().default(false),
    },
    { description: "Bulk edit fields for multiple Jira issues. Uses Jira v3 bulk edit endpoint. See: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-bulk-operations/#api-rest-api-3-bulk-issues-fields-post" },
    async ({ issueKeys, fields, sendBulkNotification }, _extra) => {
      const requestBody = {
        selectedIssueIdsOrKeys: issueKeys,
        fields,
        sendBulkNotification,
      };
      const response = await axios.post(
        `${JIRA_BASE}/rest/api/3/bulk/issues/fields`,
        requestBody,
        { headers: AUTH_HEADER }
      );
      return {
        content: [
          {
            type: "text" as const,
            text: `Bulk edit submitted. Task ID: ${response.data.taskId}`,
          },
        ],
        // taskId is not a standard MCP return property, so only include in text
      };
    }
  );

  console.log('[MCP SERVER] All tools registered: searchIssues, getAssignedIssues, getIssueByKey, transitionIssue, assignIssue, linkToEpic, createIssue, updateIssue, bulkEditIssues');
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
  console.log('Received GET /mcp request');
  console.log('Request headers:', req.headers);

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
  console.log('Received GET /sse request');
  console.log('Request headers:', req.headers);
  const server = getServer();
  const transport = new SSEServerTransport('/messages', res);

  // Store the transport by sessionId
  sseTransports[transport.sessionId] = transport;

  res.on("close", () => {
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
  console.log(`✅ Jira MCP server listening at http://localhost:${PORT}${PATH}`);
});
