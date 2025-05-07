import axios from "axios";

const getConfluenceBase = () => `https://${process.env.ATLASSIAN_DOMAIN}/wiki/api/v2`;
const getAuthHeader = () => ({
  Authorization: `Basic ${Buffer.from(`${process.env.ATLASSIAN_EMAIL}:${process.env.ATLASSIAN_API_TOKEN}`).toString("base64")}`,
  Accept: "application/json",
  "Content-Type": "application/json"
});

/**
 * Create a new Confluence page (v2)
 */
export async function createPage(spaceKey: string, title: string, body: string, parentId?: string) {
  const data: any = {
    spaceId: spaceKey,
    title,
    body: {
      representation: "storage",
      value: body
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
  console.log('[Confluence] getPage called', { pageId, bodyFormat });
  try {
    const url = `${getConfluenceBase()}/pages/${pageId}?body-format=${bodyFormat}`;
    const res = await axios.get(url, { headers: getAuthHeader() });
    console.log('[Confluence] getPage response', { data: res.data });
    return res.data;
  } catch (err) {
    console.error('[Confluence] getPage error', err);
    throw err;
  }
}

/**
 * Update a Confluence page (v2)
 */
export async function updatePage(pageId: string, newTitle: string, newBody: string, version: number, parentId?: string, message = "Updated page") {
  // Fetch current page to get required fields
  const current = await getPage(pageId);
  const data: any = {
    id: pageId,
    status: current.status || "current",
    title: newTitle || current.title,
    body: {
      representation: "storage",
      value: newBody || current.body?.storage?.value || current.body?.value || ""
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
  console.log('[Confluence] movePage called', { pageId, newParentPageId, version, message });
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
    console.log('[Confluence] movePage payload', { url: `${getConfluenceBase()}/pages/${pageId}`, data });
    const res = await axios.put(
      `${getConfluenceBase()}/pages/${pageId}`,
      data,
      { headers: getAuthHeader() }
    );
    console.log('[Confluence] movePage response', { data: res.data });
    return res.data;
  } catch (err: any) {
    console.error('[Confluence] movePage error', err?.response?.data || err);
    throw err;
  }
} 