import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

function getSheetsAuth() {
  return new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    undefined,
    process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
}

function getGmailAuth() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  );
  oauth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return oauth2;
}

async function appendToSheet(email: string, timestamp: string) {
  const auth = getSheetsAuth();
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "Sheet1!A:B",
    valueInputOption: "RAW",
    requestBody: { values: [[timestamp, email]] },
  });
}

async function sendConfirmationEmail(toEmail: string) {
  const auth = getGmailAuth();
  const gmail = google.gmail({ version: "v1", auth });
  const from = process.env.GMAIL_FROM_EMAIL;

  const subject = "You're registered — Capital in Motion";
  const body = [
    `Hi,`,
    ``,
    `Thank you for registering your interest. You're now on the founding community list for Capital in Motion.`,
    ``,
    `We're building the community now. You'll hear from us when Phase 1 opens — no spam, just meaningful updates about our progress.`,
    ``,
    `A note on what this registration is (and isn't): this is a community interest list, not an investment offer. No money is being raised or solicited. You can unsubscribe at any time by replying to this email.`,
    ``,
    `— Capital in Motion`,
  ].join("\n");

  const raw = [
    `From: Capital in Motion <${from}>`,
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    body,
  ].join("\n");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: Buffer.from(raw).toString("base64url") },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !email.includes("@") || email.length > 254) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();
    await appendToSheet(email, timestamp);

    // Confirmation email is best-effort — a failed send does not roll back the signup
    sendConfirmationEmail(email).catch((err) =>
      console.error("Confirmation email failed:", err)
    );

    return NextResponse.json({
      message:
        "You're on the list. We'll be in touch when Phase 1 opens — watch this space.",
    });
  } catch (err) {
    console.error("Waitlist error:", err);
    return NextResponse.json(
      { error: "Unable to register. Please try again." },
      { status: 500 }
    );
  }
}
