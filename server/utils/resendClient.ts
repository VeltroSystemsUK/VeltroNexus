import { Resend } from 'resend';

async function getCredentials() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    throw new Error('Resend credentials not configured. Please set RESEND_API_KEY and RESEND_FROM_EMAIL in Replit Secrets');
  }
  
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
    throw new Error('Invalid from_email in Resend configuration');
  }
  
  return {
    apiKey,
    fromEmail
  };
}

export async function getUncachableResendClient() {
  const credentials = await getCredentials();
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: credentials.fromEmail
  };
}
