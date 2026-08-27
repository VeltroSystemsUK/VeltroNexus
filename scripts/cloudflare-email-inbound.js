/**
 * Cloudflare Email Routing Worker — nexus-inbound
 *
 * Dashboard: Compute → Workers & Pages → Create → paste this file.
 * Worker variables (Settings → Variables and Secrets):
 *   NEXUS_MAIL_URL       https://stratanexus.co.uk
 *   MAIL_WEBHOOK_SECRET  
 *   FORWARD_TO           shaun@veltro.co.uk
 *
 * Then in Email Routing, send each agent address (or the Catch-all) to this Worker.
 */
export default {
  async email(message, env) {
    let text = "";
    try {
      const raw = await new Response(message.raw).text();
      text = raw.replace(/\r/g, "").split("\n\n").slice(1).join("\n\n").slice(0, 20000);
    } catch (error) {
      text = String(error);
    }

    try {
      const res = await fetch(`${env.NEXUS_MAIL_URL.replace(/\/$/, "")}/api/agent-mail/inbound`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-mail-secret": env.MAIL_WEBHOOK_SECRET,
        },
        body: JSON.stringify({
          from: message.from,
          to: message.to,
          subject: message.headers.get("subject") || "",
          text,
          messageId: message.headers.get("message-id") || "",
        }),
      });
      if (!res.ok) {
        console.log(`NEXUS inbound webhook ${res.status}`);
      }
    } catch (error) {
      console.log(`NEXUS inbound webhook failed: ${error}`);
    }

    if (env.FORWARD_TO) {
      await message.forward(env.FORWARD_TO);
    }
  },
};
