import axios from "axios";

const getConfluenceBase = () => `https://${process.env.ATLASSIAN_DOMAIN}/wiki/rest/api`;
const getAuthHeader = () => ({
  Authorization: `Basic ${Buffer.from(`${process.env.ATLASSIAN_EMAIL}:${process.env.ATLASSIAN_API_TOKEN}`).toString("base64")}`,
  Accept: "application/json",
  "Content-Type": "application/json"
});

/**
 * Create a new Confluence page
 */
export async function createPage(spaceKey: string, title: string, body: string) {
  const res = await axios.post(
    `${getConfluenceBase()}/content`,
    {
      type: "page",
      title,
      space: { key: spaceKey },
      body: {
        storage: {
          value: body,
          representation: "storage"
        }
      }
    },
    { headers: getAuthHeader() }
  );
  return res.data;
}

/**
 * Get a Confluence page by ID
 */
export async function getPage(pageId: string) {
  const res = await axios.get(`${getConfluenceBase()}/content/${pageId}`, { headers: getAuthHeader() });
  return res.data;
}

/**
 * Update a Confluence page
 */
export async function updatePage(pageId: string, newTitle: string, newBody: string, version: number) {
  const res = await axios.put(
    `${getConfluenceBase()}/content/${pageId}`,
    {
      id: pageId,
      type: "page",
      title: newTitle,
      version: { number: version },
      body: {
        storage: {
          value: newBody,
          representation: "storage"
        }
      }
    },
    { headers: getAuthHeader() }
  );
  return res.data;
}

/**
 * Delete a Confluence page
 */
export async function deletePage(pageId: string) {
  const res = await axios.delete(`${getConfluenceBase()}/content/${pageId}`, { headers: getAuthHeader() });
  return res.data;
}

/**
 * List pages in a space
 */
export async function listPages(spaceKey: string) {
  const res = await axios.get(`${getConfluenceBase()}/content?spaceKey=${spaceKey}&expand=body.storage`, { headers: getAuthHeader() });
  return res.data;
}

/**
 * Search pages by CQL query
 */
export async function searchPages(cql: string) {
  const res = await axios.get(`${getConfluenceBase()}/content/search?cql=${encodeURIComponent(cql)}`, { headers: getAuthHeader() });
  return res.data;
}

/**
 * Add a comment to a page
 */
export async function addComment(pageId: string, commentBody: string) {
  const res = await axios.post(
    `${getConfluenceBase()}/content/${pageId}/child/comment`,
    {
      type: "comment",
      body: {
        storage: {
          value: commentBody,
          representation: "storage"
        }
      }
    },
    { headers: getAuthHeader() }
  );
  return res.data;
}

/**
 * Add an attachment to a page (file should be a Buffer or ReadStream)
 */
export async function addAttachment(pageId: string, file: any, filename: string) {
  const FormData = (await import("form-data")).default;
  const form = new FormData();
  form.append("file", file, filename);
  const res = await axios.post(
    `${getConfluenceBase()}/content/${pageId}/child/attachment`,
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
 * List all spaces
 */
export async function listSpaces() {
  const res = await axios.get(`${getConfluenceBase()}/space`, { headers: getAuthHeader() });
  return res.data;
} 