// utils/mailHelper.js
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";
dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // app password recommended
  },
});

/**
 * sendMail(to, subject, html, attachments)
 * attachments: optional array compatible with nodemailer attachments:
 *   [{ filename: 'resolved.jpg', path: '/abs/path/to/file.jpg' }, ...]
 */
async function sendMail(to, subject, html, attachments = []) {
  try {
    const mailOptions = {
      from: `"Civic Portal" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    };

    if (attachments && attachments.length) {
      mailOptions.attachments = attachments;
    }

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Mail sent:", info.messageId);
    return info;
  } catch (err) {
    // show full error to help debugging
    console.error("❌ Mail error:", err && err.message ? err.message : err);
    throw err;
  }
}

export default sendMail;
