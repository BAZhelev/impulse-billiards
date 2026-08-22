import { callPayload } from "./base";

export async function getPayloadPage(title: string) {
  const data = await callPayload({
    path: `api/pages?where[title][equals]=${title}`,
  });

  return data.docs[0];
}
