// utils/aiHelper.js
export function analyzeIssue(title, description) {
  const text = `${title} ${description}`.toLowerCase();

  let priority = "low";
  if (text.includes("urgent") || text.includes("accident") || text.includes("sewage"))
    priority = "high";
  else if (text.includes("broken") || text.includes("leak"))
    priority = "medium";

  let category = "General";
  if (text.includes("road") || text.includes("pothole")) category = "Road";
  if (text.includes("water") || text.includes("sewage")) category = "Water";
  if (text.includes("garbage") || text.includes("waste")) category = "Garbage";

  return { priority, category };
}
// utils/aiHelper.js

// 📝 stub function – later you’ll connect your real AI model
export async function classifyIssue(title, description) {
  // here you can call OpenAI / TensorFlow / etc.
  // For now, return dummy values
  return {
    priority: "Medium",          // Low | Medium | High
    department: "Road Department" // e.g. Water / Road / Electrical
  };
}

