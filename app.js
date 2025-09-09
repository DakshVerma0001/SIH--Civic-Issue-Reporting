const express = require('express');
const userModel = require("./database/user");
const issueModel = require("./database/issues");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");

// Database Connection
const connectDB = require("./database/connection"); 

const app = express();

// Database connect
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));   // ✅ Important

// Import Routes
const adminRoutes = require("./routes/admin");
app.use("/admin", adminRoutes);

// Login check middleware
function isloggedin(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).send("please login first");
    }
    const data = jwt.verify(token, "ndobhal");
    req.user = data;
    next();
}

// Homepage
app.get("/", (req, res) => res.render("index"));

// Register Page
app.get("/register", (req, res) => res.render("register"));

// Register User
app.post("/register", async (req, res) => {
    let { name, email, password, role } = req.body;
    if (!role || role.trim() === "") role = "citizen";

    let existingUser = await userModel.findOne({ email });
    if (existingUser) return res.status(400).send("User already exists");

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await userModel.create({ name, email, password: hashedPassword, role });
    res.redirect("/login");
});

// Login
app.get("/login", (req, res) => res.render("login"));

app.post("/login", async (req, res) => {
    let { email, password } = req.body;
    let userexist = await userModel.findOne({ email });
    if (!userexist) return res.status(400).send("User not found!");

    let checkuser = await bcrypt.compare(password, userexist.password);
    if (!checkuser) return res.status(400).send("Invalid password!");

    // ✅ Save role in token
    const token = jwt.sign(
        { email: userexist.email, id: userexist._id, role: userexist.role },
        "ndobhal",
        { expiresIn: "7d" }
    );

    res.cookie("token", token, {
        httpOnly: true,
        secure: false,
        maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.redirect("/profile");
});

// Logout
app.get("/logout", (req, res) => {
    res.clearCookie("token", { httpOnly: true, secure: false });
    res.redirect("/login");
});

// Profile
// Profile
app.get("/profile", isloggedin, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        if (!user) return res.redirect("/login");

        // ✅ Agar admin hai toh dashboard bhejo
        if (user.role === "admin") {
            return res.redirect("/admin/dashboard");
        }

        // ✅ Agar citizen hai toh normal profile show karo
        res.render("profile", { user });
    } catch (err) {
        console.log("Profile Error:", err);
        res.status(500).send("Something went wrong!");
    }
});


// Post
const { analyzeIssue } = require("./utils/aiHelper");  // ✅ Correct import

app.get("/post", (req, res) => res.render("post"));

app.post("/post", isloggedin, async (req, res) => {
    const { title, description, location } = req.body;

    // ✅ Call AI helper (pass ek object, not 2 strings)
    const { aiCategory, aiPriority } = await analyzeIssue({ title, description, location });

    // ✅ Save issue with AI fields
    await issueModel.create({
        title,
        description,
        location,
        createdBy: req.user.id,
        aiCategory,
        aiPriority
    });

    res.redirect("/profile");
});


// ✅ Server Listen
app.listen(5000, () => {
    console.log("🚀 Server started on port 5000");
});
