function isAdmin(req, res, next) {
    if (req.user && req.user.email === "Civicfixportal@gmail.com") {
        next();
    } else {
        return res.status(403).send("Access denied! Admins only.");
    }
}

module.exports = isAdmin;
