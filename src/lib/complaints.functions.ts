import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  subject: z.string().min(3).max(150),
  message: z.string().min(10).max(2000),
});

const ADMIN_EMAIL = "applefox998@gmail.com";

export const notifyComplaint = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("RESEND_API_KEY not set; skipping email forward");
      return { ok: false, reason: "no_api_key" };
    }

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:24px;color:#0b1d3a">
        <h2 style="margin:0 0 16px;color:#1e3a8a">New Dew Trades support ticket</h2>
        <p style="margin:0 0 8px"><strong>From:</strong> ${escapeHtml(data.name)} &lt;${escapeHtml(data.email)}&gt;</p>
        <p style="margin:0 0 16px"><strong>Subject:</strong> ${escapeHtml(data.subject)}</p>
        <div style="background:#f1f5f9;border-radius:12px;padding:16px;white-space:pre-wrap;font-size:14px;line-height:1.6">${escapeHtml(data.message)}</div>
        <p style="margin-top:24px;font-size:12px;color:#64748b">This is an automated notification from Dew Trades.</p>
      </div>
    `;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Dew Trades Support <onboarding@resend.dev>",
          to: [ADMIN_EMAIL],
          reply_to: data.email,
          subject: `[Dew Trades] ${data.subject}`,
          html,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("Resend error", res.status, text);
        return { ok: false, reason: "send_failed" };
      }
      return { ok: true };
    } catch (err) {
      console.error("notifyComplaint error", err);
      return { ok: false, reason: "exception" };
    }
  });

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
