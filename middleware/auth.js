exports.isLoggedIn = (req, res, next) => {
  if (!req.user) return res.redirect("/login");
  next();
};

exports.isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).send("Access denied");
  }
  next();
};
