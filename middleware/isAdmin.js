import jwt from "jsonwebtoken";

export default function isAdmin(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.redirect("/login");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.isAdmin && decoded.email === process.env.ADMIN_EMAIL) {
      req.user = decoded;
      return next();
    }
    return res.status(403).send("Access denied! Only admin can access this page.");
  } catch (err) {
    console.error("isAdmin error:", err);
    return res.redirect("/login");
  }
}
