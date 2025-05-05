import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as jira from "./jiraClient";

export function registerTools(server: McpServer) {
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
    async (args, _extra) => {
      const result = await jira.searchIssues(args);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result),
          },
        ],
        nextPageToken: result.nextPageToken,
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
    { description: "Bulk edit fields for multiple Jira issues. Uses Jira v3 bulk edit endpoint." },
    async (args, _extra) => {
      const result = await jira.bulkEditIssues(args);
      return {
        content: [
          {
            type: "text" as const,
            text: `Bulk edit submitted. Task ID: ${result.taskId}`,
          },
        ],
      };
    }
  );

  server.tool(
    "updateIssue",
    { issueKey: z.string(), fields: z.record(z.string(), z.any()) },
    { description: "Update one or more fields on a Jira issue" },
    async (args, _extra) => {
      await jira.updateIssue(args);
      return {
        content: [
          { type: "text" as const, text: `Updated issue ${args.issueKey} with provided fields.` }
        ]
      };
    }
  );

  server.tool(
    "getIssueByKey",
    { issueKey: z.string() },
    { description: "Fetch a specific Jira issue by its key" },
    async (args, _extra) => {
      const data = await jira.getIssueByKey(args);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data) }
        ]
      };
    }
  );
  // Add other tools as needed
} 