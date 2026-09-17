import { getPayload } from "payload";
import config from "@payload-config";

// Never cache health responses — always hit the database.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await getPayload({ config });

    // Ping the database to confirm connectivity. NOTE: migrations are applied by
    // the migrator image in CI (before deploy), not here — so this check does not
    // verify that applied migrations match the bundled files.
    await payload.db.pool.query("SELECT 1");

    return Response.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("[health] check failed", error);
    return Response.json({ status: "error" }, { status: 503 });
  }
}
