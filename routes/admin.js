const express = require("express");
const router = express.Router();
const issueModel = require("../database/issues");
const isloggedin = require("../middleware/isloggedin");
const isAdmin = require("../middleware/isAdmin");
const sendMail = require("../utils/mailHelper"); // email bhejne ke liye

// Admin Dashboard → saare issues dikhna
router.get("/dashboard", isloggedin, isAdmin, async (req, res) => {
  try {
    const issues = await issueModel.find().populate("createdBy", "name email");

    //  Status counts calculate karo
    const pendingCount = await issueModel.countDocuments({ status: "Pending" });
    const inProgressCount = await issueModel.countDocuments({ status: "In Progress" });
    const resolvedCount = await issueModel.countDocuments({ status: "Resolved" });

    res.render("admin/dashboard", { 
      issues, 
      pendingCount, 
      inProgressCount, 
      resolvedCount 
    });
  } catch (err) {
    console.error("Error loading admin dashboard:", err);
    res.status(500).send("Something went wrong!");
  }
});

// Approve Issue
router.post("/issue/:id/approve", isloggedin, isAdmin, async (req, res) => {
  try {
    const issue = await issueModel.findByIdAndUpdate(
      req.params.id,
      { status: "Approved" },
      { new: true }
    ).populate("createdBy", "name email");

    if (issue && issue.createdBy) {
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

// Reject Issue
router.post("/issue/:id/reject", isloggedin, isAdmin, async (req, res) => {
  try {
    const issue = await issueModel.findByIdAndUpdate(
      req.params.id,
      { status: "Rejected" },
      { new: true }
    ).populate("createdBy", "name email");

    if (issue && issue.createdBy) {
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

module.exports = router;
