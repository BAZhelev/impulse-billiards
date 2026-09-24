import type { CollectionConfig } from "payload";

import { redeployOnPublish } from "../hooks/redeploy-site";

export const Pages: CollectionConfig = {
  slug: "pages",
  admin: {
    useAsTitle: "title",
  },
  access: {
    read() {
      return true;
    },
  },
  hooks: {
    afterChange: [redeployOnPublish],
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "content",
      type: "textarea",
      required: true,
    },
  ],
};
