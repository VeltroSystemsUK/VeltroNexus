# 📲 Step-by-Step WhatsApp Integration

Connecting your local ARES to WhatsApp requires three simple parts. Follow these steps exactly:

## Part 1: Get your Public URL (Stable Method)
1. Stop the old tunnel (Ctrl+C).
2. Run this command instead (This is the official Cloudflare tunnel):
   `npx cloudflared tunnel --url http://localhost:18790`
3. Look for the line that says: `https://[random-name].trycloudflare.com`
4. **Copy that URL**. You can test it in your browser; it should show: "✅ ARES WhatsApp Surface is ONLINE".

## Part 2: Meta Developer Portal
1. Go to your [Meta App Dashboard](https://developers.facebook.com/apps/).
2. Select your App -> **WhatsApp** -> **Configuration**.
3. Under **Webhook**, click **Edit**.
4. **Callback URL**: Paste your localtunnel URL and add `/webhook/whatsapp` at the end.
   - *Example: `https://short-ants-yell.loca.lt/webhook/whatsapp`*
5. **Verify Token**: Type: `ares_verify_token`
6. Click **Verify and Save**.

## Part 3: Webhook Fields
1. On the same Configuration page, find the **Webhook fields** table.
2. Click **Manage**.
3. Find **messages** and click **Subscribe**.
4. Click **Done**.

## ✅ You're Done!
Send a message like "Hello ARES" to your WhatsApp Business number. You should see activity in your VS Code terminals immediately!

## 🛠️ Fixing the "Couldn't be Validated" Error
If Meta gives you an error, it is because of the Localtunnel security page. Do this:

1. **Open the Link**: In your browser, open `https://smooth-weeks-win.loca.lt`.
2. **Unlock it**: Enter your IP (`103.214.45.7`) and click **Click to Continue**.
3. **Verify it**: Once you see the message "✅ ARES WhatsApp Surface is ONLINE", **leave that tab open**.
4. **Try Meta again**: Immediately go back to the Meta Portal and click **Verify and Save**.

> [!IMPORTANT]
> Meta needs to see the "raw" response. By unlocking the page in your browser first, you "open the door" for Meta's servers to peek through!
