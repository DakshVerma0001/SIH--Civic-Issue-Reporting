import express from "express";
import isAdmin from "../middleware/isAdmin.js";   // ✅ path check karo

const router = express.Router();

router.get("/dashboard", isAdmin, async (req, res) => {
  try {
    // Abhi koi DB call nahi to empty array bhej do
    const issues = [];

    res.render("admin/dashboard", { issues }); // ✅ yaha pass karna zaruri hai
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).send("Server Error");
  }
});

export default router;
