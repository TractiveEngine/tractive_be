// utils/smtp.ts

import nodemailer from "nodemailer";

// SMTP credentials must remain server-only. Never use a NEXT_PUBLIC_* value
// for a mail provider credential because Next.js can expose it to the client.
const passKey = process.env.ZEPTOMAIL_API_KEY;

if (!passKey) {
  console.error(
    "ZEPTOMAIL_API_KEY is not set in environment variables"
  );
}

const transporter = nodemailer.createTransport({
  host: "smtp.zeptomail.com",
  port: 465,
  secure: true, // true for SSL
  auth: {
    user: "emailapikey",
    pass: passKey,
  },
  debug: true,
});

// Verify SMTP connection configuration (development only)
if (process.env.NODE_ENV === 'development' && passKey) {
  transporter.verify(function (error) {
    if (error) {
      console.error("SMTP connection error:", error);
    } else {
      console.log("SMTP server is ready to send emails");
    }
  });
}

export default transporter;
