import express from "express";
import Issue from "../database/issues.js";
import { classifyIssue } from "../utils/aiHelper.js";

const router = express.Router();

// POST /issues/create
router.post("/create", async (req, res) => {
  try {
    const { title, description, location, latitude, longitude, image } = req.body;

    // 1) Call AI model
    const aiResult = await classifyIssue(title, description);

    // 2) Save issue
    const issue = new Issue({
      title,
      description,
      image,
      location,
      latitude,
      longitude,
      priority: aiResult.priority,
      category: aiResult.category,
      createdBy: req.user?._id // or send from frontend
    });

    await issue.save();
    res.status(201).json({ message: "Issue created", issue });
  } catch (err) {
    console.error("Create issue error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
