const express = require("express");
const router = express.Router();
const issueModel = require("../database/issues");
const isloggedin = require("../middleware/isloggedin");
const isAdmin = require("../middleware/isAdmin");

// Admin Dashboard → saare issues priority ke hisaab se dikhna
router.get("/dashboard", isloggedin, isAdmin, async (req, res) => {
  try {
    // AI priority ke hisaab se sorting
    const issues = await issueModel.aggregate([
      {
        $addFields: {
          priorityOrder: {
            $switch: {
              branches: [
                { case: { $eq: ["$aiPriority", "Critical"] }, then: 1 },
                { case: { $eq: ["$aiPriority", "High"] }, then: 2 },
                { case: { $eq: ["$aiPriority", "Medium"] }, then: 3 },
                { case: { $eq: ["$aiPriority", "Low"] }, then: 4 }
              ],
              default: 5
            }
          }
        }
      },
      { $sort: { priorityOrder: 1, createdAt: -1 } } // Pehle priority, fir latest
    ]);

    // Status counts calculate karo
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
    await issueModel.findByIdAndUpdate(req.params.id, { status: "Approved" });
    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error("Error approving issue:", err);
    res.status(500).send("Failed to approve issue!");
  }
});

// Reject Issue
router.post("/issue/:id/reject", isloggedin, isAdmin, async (req, res) => {
  try {
    await issueModel.findByIdAndUpdate(req.params.id, { status: "Rejected" });
    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error("Error rejecting issue:", err);
    res.status(500).send("Failed to reject issue!");
  }
});

module.exports = router;
