import express from "express";
import path from "path";
import multer from "multer";
import isAdmin from "../middleware/isAdmin.js";
import Issue from "../database/issues.js";
import sendMail from "../utils/mailHelper.js";
import fs from "fs";

const router = express.Router();

/* ---------- Multer storage ---------- */
const uploadsDir = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "_" + file.originalname.replace(/\s+/g, "_")),
});
const upload = multer({ storage });

/* ========== ADMIN DASHBOARD ========== */
router.get("/dashboard", isAdmin, async (req, res) => {
  try {
    const issues = await Issue.find().sort({ createdAt: -1 }).lean();
    const counts = {
      total: issues.length,
      pending: issues.filter(x => x.status === "pending").length,
      approved: issues.filter(x => x.status === "approved").length,
      resolved: issues.filter(x => x.status === "resolved").length,
      rejected: issues.filter(x => x.status === "rejected").length,
    };
    res.render("admin/dashboard", { issues, counts });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

/* ========== APPROVE ========== */
router.post("/issue/:id/approve", isAdmin, async (req, res) => {
  try {
    const issue = await Issue.findByIdAndUpdate(
      req.params.id,
      { status: "approved" },
      { new: true }
    ).populate("createdBy", "name email customId");

    const html = `
  <p>Hi ${issue.createdBy?.name || "User"},</p>
  <p>Your issue <strong>${issue.title}</strong> has been <b>APPROVED</b> ✅</p>

  <p>Issue ID: <strong>${issue.customId}</strong></p>

  <p>
    Track here: 
    <a href="${process.env.BASE_URL}/issue/${issue.customId}">
      ${process.env.BASE_URL}/issue/${issue.customId}
    </a>
  </p>

  <br/>Regards,<br/>Civic Portal Team
`;


    await sendMail(issue.createdBy.email, "Issue Approved", html);
    res.redirect("/admin/dashboard");
  } catch (err) {
    res.status(500).send("Error approving");
  }
});

/* ========== REJECT ========== */
router.post("/issue/:id/reject", isAdmin, async (req, res) => {
  try {
    const issue = await Issue.findByIdAndUpdate(
      req.params.id,
      { status: "rejected" },
      { new: true }
    ).populate("createdBy", "name email customId");

    const html = `<h3>Your issue was rejected</h3>`;
    await sendMail(issue.createdBy.email, "Issue Rejected", html);
    res.redirect("/admin/dashboard");
  } catch {
    res.status(500).send("Error rejecting");
  }
});

/* ========== RESOLVE (ADMIN LIVE PHOTO UPLOAD) ========== */
router.post("/resolve/:id", async (req, res) => {
  try {
    const { resolvedImage } = req.body;

    if (!resolvedImage || !resolvedImage.startsWith("data:image")) {
      return res.json({ success: false, msg: "Invalid image data" });
    }

    const issue = await Issue.findById(req.params.id).populate("createdBy");
    if (!issue) return res.json({ success: false, msg: "Issue not found" });

    // SAVE IMAGE
    const base64Data = resolvedImage.replace(/^data:image\/jpeg;base64,/, "");
    const filename = `resolved_${Date.now()}.jpg`;
    const filepath = path.join(process.cwd(), "public/uploads", filename);

    fs.writeFileSync(filepath, base64Data, "base64");

    issue.resolvedImage = `/uploads/${filename}`;
    issue.status = "resolved";
    await issue.save();

    // CONFIRMATION LINKS
    const confirmUrl = `${process.env.BASE_URL}/admin/issue/${issue.customId}/confirm?response=yes`;
    const rejectUrl = `${process.env.BASE_URL}/admin/issue/${issue.customId}/confirm?response=no`;

    // ⭐ STYLISH HTML EMAIL ⭐
    const html = `
      <div style="font-family:Arial, sans-serif; padding:20px; color:#333;">
        <h2 style="color:#2e7d32; font-size:24px;">
          ✅ Issue Marked as Resolved!
        </h2>

        <p>Hi <strong>${issue.createdBy.name}</strong>,</p>

        <p>
          Your reported issue <b>${issue.title}</b> has been marked as
          <span style="color:#2e7d32; font-weight:bold;">RESOLVED</span> 🎉
        </p>

        <div style="margin:20px 0;">
          <img src="${process.env.BASE_URL}${issue.resolvedImage}" 
              alt="Resolved Photo"
              style="max-width:420px; border-radius:12px; box-shadow:0 4px 8px rgba(0,0,0,0.2);" />
        </div>

        <p style="font-size:16px; margin-bottom:15px;">
          Please confirm if the issue is genuinely fixed:
        </p>

        <div style="text-align:center; margin:25px 0;">
          <a href="${confirmUrl}" 
            style="background:#2e7d32; color:white; padding:12px 25px;
                  text-decoration:none; border-radius:8px; font-size:16px; margin-right:15px;">
            ✔️ YES, Resolved
          </a>

          <a href="${rejectUrl}" 
            style="background:#c62828; color:white; padding:12px 25px;
                  text-decoration:none; border-radius:8px; font-size:16px;">
            ❌ NO, Not Resolved
          </a>
        </div>

        <p>Thanks for helping make the city better! 💚</p>

        <br>
        <p style="font-size:14px; color:#555;">Regards,<br>SIH Civic Portal Team</p>
      </div>
    `;

    // SEND MAIL
    await sendMail(
      issue.createdBy.email,
      `Issue Resolved — Confirmation Needed`,
      html
    );

    return res.json({ success: true });

  } catch (err) {
    console.log(err);
    return res.json({ success: false, msg: "Server error" });
  }
});


/* ========== USER CONFIRMATION ========== */
router.get("/issue/:customId/confirm", async (req, res) => {
  try {
    const { customId } = req.params;
    const { response } = req.query;

    const issue = await Issue.findOne({ customId });
    if (!issue) return res.status(404).send("Issue not found");

    // ========= IF USER SELECTED YES =========
    if (response === "yes") {
      return res.render("user/confirmed", { customId });
    }

    // ========= IF USER SELECTED NO =========
    if (response === "no") {
      return res.render("user/liveFeedback", { customId });
    }

    // If neither yes/no → bad request
    return res.status(400).send("Invalid response");

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

/* ========== USER LIVE PHOTO UPLOAD ========== */
router.post("/issue/:customId/uploadFeedback", async (req, res) => {
  try {
    const { userFeedbackImage } = req.body;

    if (!userFeedbackImage.startsWith("data:image"))
      return res.status(400).send("Invalid image");

    const issue = await Issue.findOne({ customId: req.params.customId });

    const base64 = userFeedbackImage.replace(/^data:image\/jpeg;base64,/, "");
    const filename = "feedback_" + Date.now() + ".jpg";
    fs.writeFileSync(path.join(uploadsDir, filename), base64, "base64");

    issue.userFeedbackImage = "/uploads/" + filename;
    issue.userConfirmation = "rejected";
    issue.userFeedbackDate = new Date();

    await issue.save();

    res.render("user/feedbackSuccess", { issue });
  } catch (err) {
    res.status(500).send("Upload error");
  }
});

export default router;
