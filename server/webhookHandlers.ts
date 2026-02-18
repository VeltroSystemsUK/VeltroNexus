export class WebhookHandlers {
  static async processWebhook(body: Buffer, signature: string) {
    console.log("Stripe webhooks are disabled.");
    return;
  }
}
