import express from "express";
import * as jira from "./jiraClient.js";

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
  // Add other endpoints as needed
} 