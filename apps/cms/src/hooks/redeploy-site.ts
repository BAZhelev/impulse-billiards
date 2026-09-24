import type { CollectionAfterChangeHook } from "payload";

/**
 * Debounced GitHub workflow dispatch so CMS publishes trigger a static site
 * rebuild (see .docs/deployment.md#content-sync--payload--static-site).
 *
 * MVP note: the debounce lives in-memory, which is fine for a single CMS
 * instance (staging). A multi-instance deployment would move this to a queue.
 */
const DEBOUNCE_MS = 2 * 60 * 1000; // 2 minutes of quiet before dispatching

let timer: ReturnType<typeof setTimeout> | null = null;

async function dispatchWorkflow(): Promise<void> {
  const token = process.env.GITHUB_PAT;
  const repo = process.env.GITHUB_REPO;
  const workflow = process.env.GITHUB_WORKFLOW || "deploy-static.yml";
  const ref = process.env.GITHUB_REF || "main";

  if (!token || !repo) {
    console.warn("[redeploy-site] GITHUB_PAT / GITHUB_REPO not set — skipping rebuild dispatch");
    return;
  }

  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ ref }),
  });

  if (!response.ok) {
    console.error(`[redeploy-site] dispatch failed: ${response.status} ${response.statusText}`);
  }
}

export const redeployOnPublish: CollectionAfterChangeHook = async ({ operation, doc }) => {
  // MVP: without Payload drafts, every create/update is a live content change.
  if (operation === "create" || operation === "update") {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void dispatchWorkflow();
    }, DEBOUNCE_MS);
  }

  return doc;
};
