import axios from "axios";

function getJiraBase() {
  return `https://${process.env.JIRA_DOMAIN}`;
}
function getAuthHeader() {
  return {
    Authorization: `Basic ${Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString("base64")}`,
    Accept: "application/json",
    "Content-Type": "application/json"
  };
}

interface SearchIssuesParams {
  projectKey?: string;
  assignee?: string;
  issueType?: string;
  maxResults?: number;
  startAt?: number;
  jql?: string;
}

interface BulkEditIssuesParams {
  issueKeys: string[];
  fields: Record<string, any>;
  sendBulkNotification?: boolean;
}

interface UpdateIssueParams {
  issueKey: string;
  fields: Record<string, any>;
}

interface GetIssueByKeyParams {
  issueKey: string;
}

export async function searchIssues({ projectKey, assignee, issueType, maxResults = 20, startAt = 0, jql }: SearchIssuesParams) {
  let jqlParts = [];
  if (jql) {
    jqlParts.push(jql);
  } else {
    if (projectKey) jqlParts.push(`project = '${projectKey}'`);
    if (assignee) jqlParts.push(`assignee = '${assignee}'`);
    if (issueType) jqlParts.push(`issuetype = '${issueType}'`);
  }
  const finalJql = jqlParts.length > 0 ? jqlParts.join(' AND ') : '';
  const requestBody = {
    jql: finalJql,
    maxResults,
    startAt,
    fields: ["*all"],
  };
  const response = await axios.post(
    `${getJiraBase()}/rest/api/3/search`,
    requestBody,
    { headers: getAuthHeader() }
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

export async function bulkEditIssues({ issueKeys, fields, sendBulkNotification = false }: BulkEditIssuesParams) {
  const requestBody = {
    selectedIssueIdsOrKeys: issueKeys,
    fields,
    sendBulkNotification,
  };
  const response = await axios.post(
    `${getJiraBase()}/rest/api/3/bulk/issues/fields`,
    requestBody,
    { headers: getAuthHeader() }
  );
  return { taskId: response.data.taskId };
}

export async function updateIssue({ issueKey, fields }: UpdateIssueParams) {
  await axios.put(`${getJiraBase()}/rest/api/3/issue/${issueKey}`, { fields }, { headers: getAuthHeader() });
  return { success: true };
}

export async function getIssueByKey({ issueKey }: GetIssueByKeyParams) {
  const response = await axios.get(`${getJiraBase()}/rest/api/3/issue/${issueKey}`, {
    headers: getAuthHeader(),
    params: { fields: "summary,description,status,assignee,reporter,priority,comment,project" }
  });
  return response.data;
}
// Add other Jira API functions as needed 