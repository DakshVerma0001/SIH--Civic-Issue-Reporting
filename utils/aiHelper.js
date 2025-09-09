// utils/aiHelper.js

async function analyzeIssue(title, description) {
  // ✅ Abhi ke liye dummy logic (later AI API call ayega)
  let aiCategory = "General";
  let aiPriority = "Medium";

  if (description.toLowerCase().includes("road") || title.toLowerCase().includes("road")) {
    aiCategory = "Infrastructure";
    aiPriority = "High";
  } else if (description.toLowerCase().includes("garbage")) {
    aiCategory = "Sanitation";
    aiPriority = "Medium";
  }

  return { aiCategory, aiPriority };
}

module.exports = analyzeIssue;
