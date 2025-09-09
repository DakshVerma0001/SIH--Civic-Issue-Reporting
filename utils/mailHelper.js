const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendMail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,  // ab HTML template bhejenge
    });
    console.log("✅ Email sent:", to);
  } catch (err) {
    console.error("❌ Email error:", err);
  }
}

module.exports = sendMail;
