const jwt = require("jsonwebtoken");

function isLoggedIn(req, res, next) {
    // 1. Header se token lo
    let token = null;

    if (req.headers['authorization']) {
        // Format: Bearer <token>
        token = req.headers['authorization'].split(" ")[1];
    }

    // 2. Cookie se bhi token allow karo (browser ke liye)
    if (!token && req.cookies.token) {
        token = req.cookies.token;
    }

    if (!token) {
        return res.status(401).send("Access denied! No token provided.");
    }

    try {
        const decoded = jwt.verify(token, "ndobhal");
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(400).send("Invalid token.");
    }
}

module.exports = isLoggedIn;
