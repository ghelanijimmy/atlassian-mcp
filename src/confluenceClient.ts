import axios from "axios";
import { marked } from "marked";

const getConfluenceBase = () => `https://${process.env.ATLASSIAN_DOMAIN}/wiki/api/v2`;
const getAuthHeader = () => ({
  Authorization: `Basic ${Buffer.from(`${process.env.ATLASSIAN_EMAIL}:${process.env.ATLASSIAN_API_TOKEN}`).toString("base64")}`,
  Accept: "application/json",
  "Content-Type": "application/json"
});

/**
 * Helper to get spaceId from spaceKey
 */
export async function getSpaceIdFromKey(spaceKey: string): Promise<string> {
  const url = `${getConfluenceBase()}/spaces?keys=${encodeURIComponent(spaceKey)}`;
  const res = await axios.get(url, { headers: getAuthHeader() });
  if (res.data.results && res.data.results.length > 0) {
    return res.data.results[0].id;
  }
  throw new Error(`Space with key "${spaceKey}" not found`);
}

/**
 * Create a new Confluence page (v2)
 */
export async function createPage(spaceKey: string, title: string, body: string, parentId?: string) {
  const spaceId = await getSpaceIdFromKey(spaceKey);
  const htmlBody = marked.parse(body); // Convert markdown to HTML
  const data: any = {
    spaceId,
    status: "current",
    title,
    body: {
      representation: "storage",
      value: htmlBody
    }
  };
  if (parentId) data.parentId = parentId;
  const res = await axios.post(
    `${getConfluenceBase()}/pages`,
    data,
    { headers: getAuthHeader() }
  );
  return res.data;
}

/**
 * Get a Confluence page by ID (v2)
 */
export async function getPage(pageId: string, bodyFormat = "storage") {
  try {
    const url = `${getConfluenceBase()}/pages/${pageId}?body-format=${bodyFormat}`;
    const res = await axios.get(url, { headers: getAuthHeader() });
    return res.data;
  } catch (err) {
    throw err;
  }
}

/**
 * Update a Confluence page (v2)
 */
export async function updatePage(pageId: string, newTitle: string, newBody: string, version: number, parentId?: string, message = "Updated page") {
  try {
    // Fetch current page to get required fields
    const current = await getPage(pageId);
    const htmlBody = marked.parse(newBody || current.body?.storage?.value || current.body?.value || "");
    const data: any = {
      id: pageId,
      status: current.status || "current",
      title: newTitle || current.title,
      body: {
        representation: "storage",
        value: htmlBody
      },
      version: { number: version, message }
    };
    if (parentId) data.parentId = parentId;
    const res = await axios.put(
      `${getConfluenceBase()}/pages/${pageId}`,
      data,
      { headers: getAuthHeader() }
    );
    return res.data;
  } catch (err: any) {
    throw err;
  }
}

/**
 * Delete a Confluence page (v2)
 */
export async function deletePage(pageId: string) {
  const res = await axios.delete(`${getConfluenceBase()}/pages/${pageId}`, { headers: getAuthHeader() });
  return res.data;
}

/**
 * List pages in a space (v2)
 */
export async function listPages(spaceKey: string, limit = 25, cursor?: string) {
  let url = `${getConfluenceBase()}/pages?spaceKey=${spaceKey}&limit=${limit}`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await axios.get(url, { headers: getAuthHeader() });
  return res.data;
}

/**
 * Search pages by CQL query (v2)
 */
export async function searchPages(cql: string, limit = 25, cursor?: string) {
  let url = `${getConfluenceBase()}/pages/search?cql=${encodeURIComponent(cql)}&limit=${limit}`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await axios.get(url, { headers: getAuthHeader() });
  return res.data;
}

/**
 * Add a comment to a page (v2)
 */
export async function addComment(pageId: string, commentBody: string) {
  const res = await axios.post(
    `${getConfluenceBase()}/pages/${pageId}/comments`,
    {
      body: {
        representation: "storage",
        value: commentBody
      }
    },
    { headers: getAuthHeader() }
  );
  return res.data;
}

/**
 * Add an attachment to a page (v2)
 */
export async function addAttachment(pageId: string, file: any, filename: string) {
  const FormData = (await import("form-data")).default;
  const form = new FormData();
  form.append("file", file, filename);
  const res = await axios.post(
    `${getConfluenceBase()}/pages/${pageId}/attachments`,
    form,
    {
      headers: {
        ...getAuthHeader(),
        ...form.getHeaders()
      }
    }
  );
  return res.data;
}

/**
 * List all spaces (v2)
 */
export async function listSpaces(limit = 25, cursor?: string) {
  let url = `${getConfluenceBase()}/spaces?limit=${limit}`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await axios.get(url, { headers: getAuthHeader() });
  return res.data;
}

/**
 * Move a Confluence page to be a sub-page of another page (v2)
 */
export async function movePage(pageId: string, newParentPageId: string, version: number, message = "Moved page") {
  try {
    // Fetch current page with body-format=storage
    const current = await getPage(pageId, "storage");
    const bodyValue = current.body?.storage?.value || "";
    const data: any = {
      id: pageId,
      status: current.status || "current",
      title: current.title,
      body: {
        representation: "storage",
        value: bodyValue
      },
      version: { number: version, message },
      parentId: newParentPageId
    };
    
    const res = await axios.put(
      `${getConfluenceBase()}/pages/${pageId}`,
      data,
      { headers: getAuthHeader() }
    );
    return res.data;
  } catch (err: any) {
    throw err;
  }
} 