import express from "express";
import isAdmin from "../middleware/isAdmin.js";
import Issue from "../database/issues.js";
import { Parser } from "json2csv";        // ✅ CSV
import ExcelJS from "exceljs";             // ✅ Excel

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
router.post("/approve/:id", isAdmin, async (req, res) => {
  try {
    await Issue.findByIdAndUpdate(req.params.id, { status: "approved" });
    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error("Approve error:", err);
    res.status(500).send("Server Error");
  }
});

router.post("/reject/:id", isAdmin, async (req, res) => {
  try {
    await Issue.findByIdAndUpdate(req.params.id, { status: "rejected" });
    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error("Reject error:", err);
    res.status(500).send("Server Error");
  }
});

router.post("/resolve/:id", isAdmin, async (req, res) => {
  try {
    await Issue.findByIdAndUpdate(req.params.id, { status: "resolved" });
    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error("Resolve error:", err);
    res.status(500).send("Server Error");
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
