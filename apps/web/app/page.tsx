import { ReactNode } from "react";
import { getPayloadPage } from "../payload-requests/get-page";

export default async function Page(): Promise<ReactNode> {
  const pages = await getPayloadPage("test-page");

  return <main>{JSON.stringify(pages)}</main>;
}
