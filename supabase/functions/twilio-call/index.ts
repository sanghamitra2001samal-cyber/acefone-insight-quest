import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!TWILIO_ACCOUNT_SID) throw new Error("TWILIO_ACCOUNT_SID is not configured");
    if (!TWILIO_AUTH_TOKEN) throw new Error("TWILIO_AUTH_TOKEN is not configured");
    if (!TWILIO_PHONE_NUMBER) throw new Error("TWILIO_PHONE_NUMBER is not configured");

    const { to, action, callSid } = await req.json();

    if (action === "call") {
      if (!to) throw new Error("Missing 'to' phone number");

      let normalizedTo = to.replace(/[\s\-()]/g, "");
      if (!normalizedTo.startsWith("+")) {
        normalizedTo = normalizedTo.startsWith("0") ? `+91${normalizedTo.slice(1)}` : `+91${normalizedTo}`;
      }

      const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;
      const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

      const twiml = `<Response><Say>Connecting your call.</Say><Dial callerId="${TWILIO_PHONE_NUMBER}" timeout="30">${normalizedTo}</Dial><Say>The call could not be completed. Goodbye.</Say></Response>`;

      const body = new URLSearchParams({
        To: normalizedTo,
        From: TWILIO_PHONE_NUMBER,
        Twiml: twiml,
      });

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      const data = await resp.json();

      if (!resp.ok) {
        console.error("Twilio API error:", data);
        if (data.code === 21219) {
          throw new Error(`Trial account limitation: The number ${normalizedTo} must be verified in your Twilio console before you can call it. Go to Twilio > Verified Caller IDs to add it.`);
        }
        throw new Error(`Twilio error [${resp.status}]: ${data.message || JSON.stringify(data)}`);
      }

      return new Response(JSON.stringify({ success: true, callSid: data.sid, status: data.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      if (!callSid) throw new Error("Missing callSid");

      const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${callSid}.json`;
      const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

      const resp = await fetch(url, {
        headers: { Authorization: `Basic ${credentials}` },
      });
      const data = await resp.json();

      return new Response(JSON.stringify({ status: data.status, duration: data.duration }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: unknown) {
    console.error("twilio-call error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
