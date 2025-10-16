import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

console.log("🚀 resend-password-reset function running...");

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ ok: false, error: "Email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    console.log("🔐 Forcing new password reset link for:", email);

    // 1️⃣ Generate a new password reset link
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: "edushorts://update-password", // ✅ use your deep link
        // redirect_to: "exp://localhost:8081/update-password",
      },
    });

    if (error) {
      console.error("❌ Error generating link:", error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("✅ Fresh recovery link generated:", data.action_link);

    // 2️⃣ Force Supabase to actually send the email via REST endpoint
    const emailRes = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        redirect_to: "edushorts://update-password", 
        // redirect_to: "exp://localhost:8081/update-password",
      }),
    });

    console.log("📬 Email response status:", emailRes.status);
    console.log("📬 Email response body:", await emailRes.text());

    if (emailRes.status === 429){
        return new Response (
            JSON.stringify({
                ok: false, 
                error: "Please wait about 1 minute before requesting another reset email.",
            }),
            { status: 429, headers: { "Content-Type": "application/json" } }
        ); 
    }

    if (!emailRes.ok) {
      const text = await emailRes.text();
      console.error("❌ Failed to send email:", text);
      return new Response(JSON.stringify({ ok: false, error: text }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("✅ Password reset email sent successfully!");

    return new Response(
      JSON.stringify({
        ok: true,
        message: "New reset password email sent successfully",
        link: data.action_link, // you can log this link for debug
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("💥 Edge function error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
