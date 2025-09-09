const jwt = require("jsonwebtoken");

function isLoggedIn(req, res, next) {
    // ✅ Cookie se token lo
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).send("Access denied! No token provided.");
    }

    try {
        // ✅ Verify token
        const decoded = jwt.verify(token, "ndobhal"); // env se bhi le sakte ho
        req.user = decoded;
        next();
    } catch (err) {
        res.status(400).send("Invalid token.");
    }
}

module.exports = isLoggedIn;
