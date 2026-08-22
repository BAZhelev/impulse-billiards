const URL = process.env.PAYLOAD_URL;

type Args = {
  path: string;
};

export async function callPayload({ path }: Args) {
  const response = await fetch(`${URL}/${path}`);

  return response.json();
}
