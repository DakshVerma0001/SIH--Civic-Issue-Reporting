// routes/adminRoutes.js
import express from "express";
import isAdmin from "../middleware/isAdmin.js";   // ✅ check path
import Issue from "../database/issues.js";        // ✅ check path

const router = express.Router();

/* ========== ADMIN DASHBOARD ========== */
router.get("/dashboard", isAdmin, async (req, res) => {
  try {
    // Fetch all issues, newest first
    const issues = await Issue.find().sort({ createdAt: -1 });

    // 👉 Build counts for the top widgets
    const counts = {
      total: issues.length,
      pending: issues.filter(i => i.status === "Pending").length,
      approved: issues.filter(i => i.status === "In Progress").length, // or "Approved"
      resolved: issues.filter(i => i.status === "Resolved").length,
    };

    res.render("admin/dashboard", {
      issues,
      counts, // pass to EJS
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).send("Server Error");
  }
});

/* ========== APPROVE AN ISSUE ========== */
router.post("/approve/:id", isAdmin, async (req, res) => {
  try {
    await Issue.findByIdAndUpdate(req.params.id, { status: "In Progress" });
    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error("Approve error:", err);
    res.status(500).send("Server Error");
  }
});

/* ========== REJECT AN ISSUE ========== */
router.post("/reject/:id", isAdmin, async (req, res) => {
  try {
    await Issue.findByIdAndUpdate(req.params.id, { status: "Rejected" });
    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error("Reject error:", err);
    res.status(500).send("Server Error");
  }
});

/* ========== MARK AS RESOLVED ========== */
router.post("/resolve/:id", isAdmin, async (req, res) => {
  try {
    await Issue.findByIdAndUpdate(req.params.id, { status: "Resolved" });
    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error("Resolve error:", err);
    res.status(500).send("Server Error");
  }
});

export default router;
