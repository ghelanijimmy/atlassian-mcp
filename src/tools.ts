import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as jira from "./jiraClient.js";
import * as confluence from "./confluenceClient.js";

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

  // Confluence tools
  server.tool(
    "confluenceCreatePage",
    {
      spaceKey: z.string(),
      title: z.string(),
      body: z.string(),
    },
    { description: "Create a new Confluence page in a given space." },
    async (args, _extra) => {
      const result = await confluence.createPage(args.spaceKey, args.title, args.body);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    "confluenceGetPage",
    { pageId: z.string() },
    { description: "Get a Confluence page by its ID." },
    async (args, _extra) => {
      const result = await confluence.getPage(args.pageId);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    "confluenceUpdatePage",
    {
      pageId: z.string(),
      newTitle: z.string(),
      newBody: z.string(),
      version: z.number(),
    },
    { description: "Update a Confluence page (title/body/version required)." },
    async (args, _extra) => {
      const result = await confluence.updatePage(args.pageId, args.newTitle, args.newBody, args.version);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    "confluenceDeletePage",
    { pageId: z.string() },
    { description: "Delete a Confluence page by its ID." },
    async (args, _extra) => {
      const result = await confluence.deletePage(args.pageId);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    "confluenceListPages",
    { spaceKey: z.string() },
    { description: "List all pages in a Confluence space." },
    async (args, _extra) => {
      const result = await confluence.listPages(args.spaceKey);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    "confluenceSearchPages",
    { cql: z.string() },
    { description: "Search Confluence pages using a CQL query." },
    async (args, _extra) => {
      const result = await confluence.searchPages(args.cql);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    "confluenceAddComment",
    { pageId: z.string(), commentBody: z.string() },
    { description: "Add a comment to a Confluence page." },
    async (args, _extra) => {
      const result = await confluence.addComment(args.pageId, args.commentBody);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    "confluenceAddAttachment",
    { pageId: z.string(), fileBase64: z.string(), filename: z.string() },
    { description: "Add an attachment to a Confluence page. File should be base64-encoded." },
    async (args, _extra) => {
      const buffer = Buffer.from(args.fileBase64, "base64");
      const result = await confluence.addAttachment(args.pageId, buffer, args.filename);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    "confluenceListSpaces",
    {},
    { description: "List all Confluence spaces." },
    async (_args, _extra) => {
      const result = await confluence.listSpaces();
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    }
  );
  // Add other tools as needed
} 