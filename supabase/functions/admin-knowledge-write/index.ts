import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Verify caller is authenticated and has app_metadata.role = 'admin'
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Missing authorization" }, 401);

  const callerToken = authHeader.slice(7);

  // Use service role client to verify the user token — avoids anon key mismatch
  const adminVerify = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: { user }, error: authError } = await adminVerify.auth.getUser(callerToken);
  if (authError || !user) return json({ error: "Invalid token" }, 401);

  const appRole = (user.app_metadata as Record<string, string> | undefined)?.role;
  if (appRole !== "admin") return json({ error: "Forbidden: admin only" }, 403);

  // Parse operation
  const body = await req.json() as {
    action: "insert" | "update" | "delete";
    payload?: Record<string, unknown>;
    id?: string;
  };

  const { action, payload, id } = body;
  if (!action) return json({ error: "Missing action" }, 400);

  // Execute with service role (bypasses RLS)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  if (action === "insert") {
    if (!payload) return json({ error: "Missing payload" }, 400);
    const { data, error } = await admin
      .from("knowledge_resources")
      .insert(payload)
      .select()
      .single();
    if (error) return json({ error: error.message, code: error.code }, 400);
    return json({ data });
  }

  if (action === "update") {
    if (!id || !payload) return json({ error: "Missing id or payload" }, 400);
    const { data, error } = await admin
      .from("knowledge_resources")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) return json({ error: error.message, code: error.code }, 400);
    return json({ data });
  }

  if (action === "delete") {
    if (!id) return json({ error: "Missing id" }, 400);
    const { error } = await admin
      .from("knowledge_resources")
      .delete()
      .eq("id", id);
    if (error) return json({ error: error.message, code: error.code }, 400);
    return json({ data: null });
  }

  return json({ error: "Unknown action" }, 400);
});
