const express = require("express");
const router = express.Router();
const issueModel = require("../database/issuesmodels");

// ✅ User Accept kare
router.get("/issue/:id/accept/:token", async (req, res) => {
  try {
    const issue = await issueModel.findOne({
      _id: req.params.id,
      verifyToken: req.params.token,
    });
    if (!issue) return res.status(400).send("Invalid or expired link");

    issue.status = "Closed";
    issue.verifyToken = null;
    await issue.save();

    res.send("✅ Thank you! Your issue has been closed.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong!");
  }
});

// ❌ User Decline kare
router.get("/issue/:id/decline/:token", async (req, res) => {
  try {
    const issue = await issueModel.findOne({
      _id: req.params.id,
      verifyToken: req.params.token,
    });
    if (!issue) return res.status(400).send("Invalid or expired link");

    issue.status = "Pending";
    issue.verifyToken = null;
    await issue.save();

    res.send("❌ Thanks! The issue will remain pending.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong!");
  }
});

module.exports = router;
