import { getPayload } from "payload";
import config from "@payload-config";

// Never cache health responses — always hit the database.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await getPayload({ config });

    // Ping the database. With `prodMigrations` enabled, Payload also runs any
    // pending migrations before initialising, so a successful init implies the
    // schema is current.
    await payload.db.pool.query("SELECT 1");

    return Response.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("[health] check failed", error);
    return Response.json({ status: "error" }, { status: 503 });
  }
}
