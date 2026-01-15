// utils/sendEmail.ts
import fs from "fs";
import path from "path";
import transporter from "./smtp";

const loadTemplate = (templateName: string): string => {
  const filePath = path.join(
    process.cwd(),
    "email-templates",
    `${templateName}.html`
  );
  return fs.readFileSync(filePath, "utf-8");
};

interface EmailPayload {
  to: string;
  subject: string;
  template: string; // The template name (e.g. "signup")
  replacements: Record<string, string | number>; // Data to replace dynamic fields in the template
  attachments?: Array<{
    filename: string;
    content: string;
  }>;
}

const sendEmail = async ({
  to,
  subject,
  template,
  replacements,
}: EmailPayload) => {
  try {
    if (!to || !to.includes("@")) {
      throw new Error("Invalid recipient email address");
    }

    // In test environment, skip actual email sending
    if (process.env.NODE_ENV === 'test') {
      console.log(`[TEST] Email would be sent to: ${to}, subject: ${subject}`);
      return;
    }

    // Load the email template
    let htmlContent = loadTemplate(template);

    // Replace placeholders with actual data
    Object.keys(replacements).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, "g"); // Look for {{key}} in the HTML
      htmlContent = htmlContent.replace(regex, String(replacements[key] ?? ""));
    });

    // Define email options
    const mailOptions = {
      from: '"Tractive Engine" <noreply@www.diboruwa.com>',
      to,
      subject,
      html: htmlContent,
    };

    // Send the email using nodemailer
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: ", info.response);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email");
  }
};

export default sendEmail;
