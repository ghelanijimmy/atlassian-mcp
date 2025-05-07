import express from "express";
import * as jira from "./jiraClient.js";
import * as confluence from "./confluenceClient.js";

export function registerRestApi(app: express.Express) {
  app.post("/api/issues/search", async (req, res) => {
    try {
      const result = await jira.searchIssues(req.body);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/issues/bulk-edit", async (req, res) => {
    try {
      const result = await jira.bulkEditIssues(req.body);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/issues/update", async (req, res) => {
    try {
      const result = await jira.updateIssue(req.body);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/api/issues/:issueKey", async (req, res) => {
    try {
      const result = await jira.getIssueByKey({ issueKey: req.params.issueKey });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Confluence endpoints
  app.post("/api/confluence/pages", async (req, res) => {
    const { spaceKey, title, body, parentId } = req.body;
    try {
      const page = await confluence.createPage(spaceKey, title, body, parentId);
      res.json(page);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/api/confluence/pages/:id", async (req, res) => {
    try {
      const page = await confluence.getPage(req.params.id);
      res.json(page);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.put("/api/confluence/pages/:id", async (req, res) => {
    const { title, body, version, parentId } = req.body;
    try {
      const page = await confluence.updatePage(req.params.id, title, body, version, parentId);
      res.json(page);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete("/api/confluence/pages/:id", async (req, res) => {
    try {
      const result = await confluence.deletePage(req.params.id);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/api/confluence/pages", async (req, res) => {
    const { spaceKey } = req.query;
    try {
      const pages = await confluence.listPages(spaceKey as string);
      res.json(pages);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/api/confluence/search", async (req, res) => {
    const { cql } = req.query;
    try {
      const results = await confluence.searchPages(cql as string);
      res.json(results);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/confluence/pages/:id/comments", async (req, res) => {
    const { commentBody } = req.body;
    try {
      const comment = await confluence.addComment(req.params.id, commentBody);
      res.json(comment);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/confluence/pages/:id/attachments", async (req, res) => {
    // For simplicity, expects file as base64 string and filename in body
    const { fileBase64, filename } = req.body;
    try {
      const buffer = Buffer.from(fileBase64, "base64");
      const attachment = await confluence.addAttachment(req.params.id, buffer, filename);
      res.json(attachment);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/api/confluence/spaces", async (req, res) => {
    try {
      const spaces = await confluence.listSpaces();
      res.json(spaces);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/confluence/pages/:id/move", async (req, res) => {
    const { newParentPageId, version } = req.body;
    console.log('[REST API] /api/confluence/pages/:id/move called', {
      pageId: req.params.id,
      newParentPageId,
      version,
      body: req.body
    });
    try {
      const result = await confluence.movePage(req.params.id, newParentPageId, version);
      console.log('[REST API] movePage result', { result });
      res.json(result);
    } catch (err: any) {
      console.error('[REST API] movePage error', err?.response?.data || err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Add other endpoints as needed
} 