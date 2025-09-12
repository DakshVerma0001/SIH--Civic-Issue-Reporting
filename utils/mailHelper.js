const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,   // ✅ tumhara gmail
    pass: process.env.EMAIL_PASS,   // ✅ app password (not normal password)
  },
});

async function sendMail(to, subject, html) {
  try {
    const info = await transporter.sendMail({
      from: `"Civic Portal" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("✅ Mail sent:", info.messageId);
    return info;
  } catch (err) {
    console.error("❌ Mail error:", err.message);
    throw err;
  }
}

module.exports = sendMail;
