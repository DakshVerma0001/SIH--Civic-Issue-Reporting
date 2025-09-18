import express from "express";
import isAdmin from "../middleware/isAdmin.js";
import Issue from "../database/issues.js";
import { Parser } from "json2csv";        // ✅ CSV
import ExcelJS from "exceljs";             // ✅ Excel
import sendMail from "../utils/mailHelper.js";   // 👈 adjust path if needed
import User from "../database/user.js";        // for getting user's email


const router = express.Router();

/* ========== ADMIN DASHBOARD ========== */
router.get("/dashboard", isAdmin, async (req, res) => {
  try {
    const issues = await Issue.find().sort({ createdAt: -1 });

    // Status wise count nikalna
    const statusCounts = await Issue.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // counts object banao (total/pending/approved/resolved)
    const counts = {
      total: issues.length,
      pending: 0,
      approved: 0,
      resolved: 0,
      rejected: 0,
    };

    statusCounts.forEach((item) => {
      const key = item._id?.toLowerCase();
      if (key && counts.hasOwnProperty(key)) {
        counts[key] = item.count;
      }
    });

    res.render("admin/dashboard", { issues, counts });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).send("Server Error");
  }
});

/* ========== APPROVE / REJECT / RESOLVE ========== */
// Approve an issue
router.post("/issue/:id/approve", async (req, res) => {
  try {
    const issue = await Issue.findByIdAndUpdate(
      req.params.id,
      { status: "approved" },
      { new: true }
    ).populate("createdBy", "name email customId");

    if (!issue) return res.status(404).send("Issue not found");

    const html = `
      <p>Hi ${issue.createdBy.name || "User"},</p>
      <p>Your issue <strong>${issue.title}</strong> has been <b>APPROVED</b> ✅</p>
      <p>Issue ID: <strong>${issue.customId}</strong></p>
      <p>You can track it here:
         <a href="${process.env.BASE_URL}/issue/${issue.customId}">
           ${process.env.BASE_URL}/issue/${issue.customId}
         </a>
      </p>
      <br/>Regards,<br/>SIH Civic Portal Team
    `;

    await sendMail(issue.createdBy.email, `Issue Approved — ID: ${issue.customId}`, html);

    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error("Approve error:", err);
    res.status(500).send("Error approving issue");
  }
});


// Reject an issue
router.post("/issue/:id/reject", async (req, res) => {
  try {
    const issue = await Issue.findByIdAndUpdate(
      req.params.id,
      { status: "rejected" },
      { new: true }
    ).populate("createdBy", "name email customId");

    if (!issue) return res.status(404).send("Issue not found");

    const html = `
      <p>Hi ${issue.createdBy.name || "User"},</p>
      <p>Your issue <strong>${issue.title}</strong> has been <b>REJECTED</b> ❌</p>
      <p>Issue ID: <strong>${issue.customId}</strong></p>
      <p>If you think this was a mistake, please re-submit with more details.</p>
      <br/>Regards,<br/>SIH Civic Portal Team
    `;

    await sendMail(issue.createdBy.email, `Issue Rejected — ID: ${issue.customId}`, html);

    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error("Reject error:", err);
    res.status(500).send("Error rejecting issue");
  }
});
// Resolve an issue
router.post("/issue/:id/resolve", async (req, res) => {
  try {
    const issue = await Issue.findByIdAndUpdate(
      req.params.id,
      { status: "resolved" },
      { new: true }
    ).populate("createdBy", "name email customId");

    if (!issue) return res.status(404).send("Issue not found");

    const html = `
      <p>Hi ${issue.createdBy.name || "User"},</p>
      <p>Your issue <strong>${issue.title}</strong> has been <b>RESOLVED</b> 🎉</p>
      <p>Issue ID: <strong>${issue.customId}</strong></p>
      <p>Thanks for helping improve the community!</p>
      <br/>Regards,<br/>SIH Civic Portal Team
    `;

    await sendMail(issue.createdBy.email, `Issue Resolved — ID: ${issue.customId}`, html);

    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error("Resolve error:", err);
    res.status(500).send("Error resolving issue");
  }
});

/* ========== EXPORT ISSUES AS CSV ========== */
router.get("/export/csv", isAdmin, async (req, res) => {
  try {
    const issues = await Issue.find().lean();

    const fields = [
      { label: "ID", value: "_id" },
      { label: "Title", value: "title" },
      { label: "Description", value: "description" },
      { label: "Status", value: "status" },
      { label: "Location", value: "location" },
      { label: "Latitude", value: "latitude" },
      { label: "Longitude", value: "longitude" },
      { label: "Created At", value: "createdAt" },
      { label: "Updated At", value: "updatedAt" },
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(issues);

    res.header("Content-Type", "text/csv");
    res.attachment("issues.csv");
    res.send(csv);
  } catch (err) {
    console.error("CSV export error:", err);
    res.status(500).send("Server Error");
  }
});

/* ========== EXPORT ISSUES AS EXCEL ========== */
router.get("/export/excel", isAdmin, async (req, res) => {
  try {
    const issues = await Issue.find().lean();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Issues");

    worksheet.columns = [
      { header: "ID", key: "_id", width: 28 },
      { header: "Title", key: "title", width: 20 },
      { header: "Description", key: "description", width: 30 },
      { header: "Status", key: "status", width: 15 },
      { header: "Location", key: "location", width: 30 },
      { header: "Latitude", key: "latitude", width: 15 },
      { header: "Longitude", key: "longitude", width: 15 },
      { header: "Created At", key: "createdAt", width: 25 },
      { header: "Updated At", key: "updatedAt", width: 25 },
    ];

    worksheet.addRows(issues);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=issues.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Excel export error:", err);
    res.status(500).send("Server Error");
  }
});

export default router;
