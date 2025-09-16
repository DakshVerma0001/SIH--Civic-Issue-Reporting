// services/aiClassifier.js
export default async function classifyIssue(title, description) {
  // Call your real model here
  // For now, returning dummy values
  return {
    priority: "low",    // or "medium"/"high"
    category: "road"    // or "water"/"electricity"
  };
}
