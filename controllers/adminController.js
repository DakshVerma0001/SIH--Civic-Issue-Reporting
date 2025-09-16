import Issue from "../database/issues";

exports.getDashboard = async (req, res) => {
  const issues = await Issue.find().limit(5).lean();
  res.render("admin/dashboard", { issues });
};

exports.getAllIssues = async (req, res) => {
  const issues = await Issue.find().sort({ createdAt: -1 }).lean();
  res.render("admin/issuesList", { issues });
};

exports.getIssueById = async (req, res) => {
  const issue = await Issue.findById(req.params.id).lean();
  res.render("admin/issueDetails", { issue });
};

exports.updateStatus = async (req, res) => {
  await Issue.findByIdAndUpdate(req.params.id, { status: req.body.status });
  res.redirect("/admin/issues");
};
