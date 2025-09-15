const express = require("express");
const router = express.Router();
const { isLoggedIn, isAdmin } = require("../middleware/auth");
const adminController = require("../controllers/adminController");

// Dashboard
router.get("/dashboard", isLoggedIn, isAdmin, adminController.getDashboard);

// All issues
router.get("/issues", isLoggedIn, isAdmin, adminController.getAllIssues);

// Issue detail
router.get("/issues/:id", isLoggedIn, isAdmin, adminController.getIssueById);

// Close / update status
router.post("/issues/:id/status", isLoggedIn, isAdmin, adminController.updateStatus);

module.exports = router;
