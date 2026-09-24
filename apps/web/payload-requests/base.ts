import { env } from "../src/env";

type Args = {
  path: string;
};

export async function callPayload({ path }: Args) {
  const response = await fetch(`${env.PAYLOAD_URL}/${path}`, {
    // Snapshot CMS content at build time (static export).
    cache: "force-cache",
  });

  return response.json();
}
