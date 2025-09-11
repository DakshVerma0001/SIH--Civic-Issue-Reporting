const express = require("express");
const router = express.Router();
const issueModel = require("../database/issuesmodels");
const isloggedin = require("../middleware/isloggedin");
const isAdmin = require("../middleware/isAdmin");
const sendMail = require("../utils/mailHelper"); // email bhejne ke liye
const crypto = require("crypto");
// ================= Admin Dashboard =================
router.get("/dashboard", isloggedin, isAdmin, async (req, res) => {
  try {
    const issues = await issueModel.find().populate("createdBy", "name email");

    // 🔹 Status counts
    const statusCounts = await issueModel.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    // 🔹 Priority counts
    const priorityCounts = await issueModel.aggregate([
      { $group: { _id: "$aiPriority", count: { $sum: 1 } } }
    ]);

    // 🔹 Category counts
    const categoryCounts = await issueModel.aggregate([
      { $group: { _id: "$aiCategory", count: { $sum: 1 } } }
    ]);

   res.render("admin/dashboard", { 
  issues, 
  pendingCount: statusCounts.pending,
  inProgressCount: statusCounts.inProgress,
  resolvedCount: statusCounts.resolved,
  priorityCounts,
  categoryCounts
});

  } catch (err) {
    console.error("Error loading admin dashboard:", err);
    res.status(500).send("Something went wrong!");
  }
});

// ================= Approve Issue =================
router.post("/issue/:id/approve", isloggedin, isAdmin, async (req, res) => {
  try {
    const issue = await issueModel.findByIdAndUpdate(
      req.params.id,
      { status: "Approved" },
      { new: true }
    ).populate("createdBy", "name email");

    if (issue?.createdBy) {
      await sendMail(
        issue.createdBy.email,
        "Your Issue has been Approved ✅",
        `Hello ${issue.createdBy.name},\n\nYour issue titled "${issue.title}" has been approved by the admin.\n\nIssue ID: ${issue._id}\nStatus: Approved\n\nThank you for reporting!`
      );
    }

    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error("Error approving issue:", err);
    res.status(500).send("Failed to approve issue!");
  }
});

// ================ Reject Issue =================
router.post("/issue/:id/reject", isloggedin, isAdmin, async (req, res) => {
  try {
    const issue = await issueModel.findByIdAndUpdate(
      req.params.id,
      { status: "Rejected" },
      { new: true }
    ).populate("createdBy", "name email");

    if (issue?.createdBy) {
      await sendMail(
        issue.createdBy.email,
        "Your Issue has been Rejected ❌",
        `Hello ${issue.createdBy.name},\n\nYour issue titled "${issue.title}" has been rejected by the admin.\n\nIssue ID: ${issue._id}\nStatus: Rejected\n\nPlease check again or contact support.`
      );
    }

    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error("Error rejecting issue:", err);
    res.status(500).send("Failed to reject issue!");
  }
});
// ================= Mark as Resolved =================
router.post("/issue/:id/resolve", isloggedin, isAdmin, async (req, res) => {
  try {
    const issue = await issueModel.findById(req.params.id).populate("createdBy", "name email");
    if (!issue) return res.status(404).send("Issue not found");

    // status ko Resolved set karo
    issue.status = "Resolved";

    // unique token banao
    issue.verifyToken = crypto.randomBytes(20).toString("hex");
    await issue.save();

    const base = process.env.BASE_URL || "http://localhost:3000";
    const acceptUrl = `${base}/issue/${issue._id}/accept/${issue.verifyToken}`;
    const declineUrl = `${base}/issue/${issue._id}/decline/${issue.verifyToken}`;

    await sendMail(
      issue.createdBy.email,
      "Please verify if your issue is resolved ✅",
      `Hello ${issue.createdBy.name},

Your issue "${issue.title}" has been marked as Resolved.

Please click:
✅ Accept: ${acceptUrl}
❌ Decline: ${declineUrl}

Thanks!`
    );

    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error("Error resolving issue:", err);
    res.status(500).send("Failed to resolve issue!");
  }
});

module.exports = router;
