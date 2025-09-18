import express from 'express';
import userModel from "./database/user.js";
import issueModel from "./database/issues.js";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import AWS from "aws-sdk";
import fs from "fs";
import axios from "axios";
import sendMail from "./utils/mailHelper.js";
import multerS3 from "multer-s3";
import dotenv from "dotenv";
import adminRoutes from "./routes/adminRoutes.js"; // <-- converted require to import

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET is missing. Set it in .env");
  process.exit(1);
}

// temporary in-memory store for OTPs (dev only)
const emailOtpStore = {}; // { "<email>": { otp: "123456", expiresAt: Date } }
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const verifiedEmails = {}; // { "<email>": timestampUntilValid }
const VERIFIED_TTL_MS = 10 * 60 * 1000; // 10 minutes window

const app = express();

// ---------- Reverse Geocode API ----------
app.get("/reverse-geocode", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    const apiKey = process.env.OPENCAGE_API_KEY;

    const response = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${apiKey}`
    );
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      return res.json({ display_name: data.results[0].formatted });
    } else {
      return res.json({ display_name: `${lat}, ${lon}` });
    }
  } catch (err) {
    console.error("Reverse geocode failed", err);
    res.json({ display_name: "Unknown Location" });
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set("view engine", "ejs");
app.use(express.static("public"));

// ----------------- MIDDLEWARE -----------------
function isloggedin(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.redirect("/login");
    }
    try {
        const data = jwt.verify(token, process.env.JWT_SECRET);
        req.user = data;
        next();
    } catch (err) {
        return res.redirect("/login");
    }
}

// AWS setup
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

// ----------------- LOGIN -----------------
app.post("/login", async function (req, res) {
  try {
    const { email, password } = req.body;

    // --- ✅ First: check if admin ---
    if (
      email === process.env.ADMIN_EMAIL &&
      password === process.env.ADMIN_PASSWORD
    ) {
      const token = jwt.sign(
        { email, isAdmin: true },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.redirect("/admin/dashboard");
    }

    // --- 👤 Normal user flow ---
    const userexist = await userModel.findOne({ email });
    if (!userexist) return res.status(400).send("User not found!");

    const checkuser = await bcrypt.compare(password, userexist.password);
    if (!checkuser) return res.status(400).send("Invalid password!");

    const token = jwt.sign(
      { email: userexist.email, id: userexist._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.redirect("/profile");
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Server error");
  }
});

// ----------------- PROFILE -----------------
app.get("/profile", isloggedin, async function (req, res) {
    try {
        const user = await userModel.findOne({_id:req.user.id});
        if (!user) return res.redirect("/login");

        const issues = await issueModel.find({ createdBy: user._id });
        res.render("profile", { user, issues });
    } catch (err) {
        res.status(500).send("Something went wrong!");
    }
});

// disk storage
const storage = multerS3({
    s3: s3,
    bucket: "sih-civicissue",
    key: function (req, file, cb) {
        cb(null, Date.now().toString() + "_" + file.originalname);
    }
});

const upload = multer({ storage });

// Homepage
app.get("/", (req, res) => res.render("index"));

// Send OTP to email
app.post("/send-email-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, msg: "Email required" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    emailOtpStore[email] = { otp, expiresAt: Date.now() + OTP_TTL_MS };

    const html = `<p>Your verification OTP is <strong>${otp}</strong>. It will expire in 5 minutes.</p>`;
    await sendMail(email, "Your verification OTP", html);

    console.log("Email OTP sent:", email, otp);
    return res.json({ success: true, msg: "OTP sent" });
  } catch (err) {
    console.error("send-email-otp error:", err);
    return res.status(500).json({ success: false, msg: "Failed to send OTP" });
  }
});

// Verify OTP
app.post("/verify-email-otp", (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, msg: "Email and OTP required" });

    const record = emailOtpStore[email];
    if (!record) return res.status(400).json({ success: false, msg: "No OTP requested for this email" });
    if (Date.now() > record.expiresAt) { delete emailOtpStore[email]; return res.status(400).json({ success: false, msg: "OTP expired" }); }
    if (record.otp !== otp.toString()) return res.status(400).json({ success: false, msg: "Invalid OTP" });

    verifiedEmails[email] = Date.now() + VERIFIED_TTL_MS;
    delete emailOtpStore[email];

    return res.json({ success: true, msg: "Email verified" });
  } catch (err) {
    console.error("verify-email-otp error:", err);
    return res.status(500).json({ success: false, msg: "Verification failed" });
  }
});

// Register & login pages
app.get("/register", (req, res) => res.render("register"));
app.get("/login", (req, res) => res.render("login"));
app.get("/logout", (req, res) => {
    res.clearCookie("token", { httpOnly: true, secure: false });
    res.redirect("/login");
});

// Register User
app.post("/register", async (req, res) => {
    let { name, email, password, confirmpassword, role, phone, latitude, longitude, address } = req.body;

    if (!verifiedEmails[email] || Date.now() > verifiedEmails[email]) return res.status(400).send("Please verify your email before registering");
    delete verifiedEmails[email];

    if (password !== confirmpassword) return res.status(400).send("Passwords do not match!");
    if (!role || role.trim() === "") role = "citizen";

    let existingUser = await userModel.findOne({ email });
    if (existingUser) return res.status(400).send("User already exists");

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await userModel.create({ name, email, password: hashedPassword, role, phone, address, latitude, longitude });

    res.redirect("/login");
});

// Post issue page
app.get("/post", isloggedin, (req, res) => res.render("post"));

// Post issue handler
app.post("/post", isloggedin, upload.single("image"), async (req, res) => {
  try {
    let { title, description, location, latitude, longitude, manualLocation } = req.body;
    if (!location || location.trim() === "")
      location = manualLocation || "Unknown Location";
    if (!title || !description || !location)
      return res.status(400).send("please fill all the required fields");

    const newissue = await issueModel.create({
      title,
      description,
      location,
      latitude: latitude || null,
      longitude: longitude || null,
      image: req.file ? req.file.location : null,
      createdBy: req.user.id,
    });

    const user = await userModel.findById(req.user.id);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      location
    )}`;
    const issueUrl = `${process.env.BASE_URL}/issue/${newissue.customId}`;

    const html = `
      <p>Hi ${user.name || "User"},</p>
      <p>Your civic issue has been reported successfully ✅</p>
      <ul>
        <li><strong>User ID:</strong> ${user.customId}</li>
        <li><strong>Issue ID:</strong> ${newissue.customId}</li>
        <li><strong>Title:</strong> ${newissue.title}</li>
        <li><strong>Location:</strong> <a href="${mapsUrl}" target="_blank">${location}</a></li>
      </ul>
      <p>Track here: <a href="${issueUrl}">${issueUrl}</a></p>
      <br/><p>Regards,<br/>SIH Civic Portal Team</p>
    `;

    await sendMail(user.email, `Issue Received — ID: ${newissue.customId}`, html);

    res.redirect("/profile");
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong while posting the issue");
  }
});

// Single issue page
app.get("/issue/:customId", isloggedin, async (req, res) => {
  try {
    const issue = await issueModel
      .findOne({ customId: req.params.customId })
      .populate("createdBy", "name email");

    if (!issue) return res.status(404).send("Issue not found");

    res.render("issue", { issue });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading issue");
  }
});


// Profile edit
app.get("/profile/edit", isloggedin, async (req, res) => {
    const user = await userModel.findById(req.user.id);
    res.render("editprofile", { user });
});

app.post("/profile/edit", isloggedin, upload.single("profilepic"), async (req, res) => {
    try {
        const { name, email } = req.body;
        let updatedata = { name, email };
        if (req.file) updatedata.profilepic = req.file.location;
        await userModel.findByIdAndUpdate(req.user.id, updatedata, { new: true });
        res.redirect("/profile");
    } catch (err) {
        console.log(err);
        if (err.code === 11000) return res.status(400).send("email already exists");
        res.status(500).send("could not update profile");
    }
});

// Edit issue
app.get("/issue/edit/:id", isloggedin, async (req, res) => {
    try {
        const issue = await issueModel.findById(req.params.id);
        if (!issue) return res.status(404).send("Issue not found");
        if (!issue.createdBy || issue.createdBy.toString() !== req.user.id) return res.status(403).send("Not authorized");
        res.render("editIssue", { issue });
    } catch (err) {
        console.error("Edit issue error:", err);
        res.status(500).send("Server error");
    }
});

app.post("/issue/edit/:id", isloggedin, async (req, res) => {
    const { title, description, manualLocation } = req.body;
    await issueModel.findOneAndUpdate(
        { _id: req.params.id, createdBy: req.user.id },
        { title, description, location: manualLocation }
    );
    res.redirect("/profile");
});

app.post("/issue/delete/:id", isloggedin, async (req, res) => {
    await issueModel.findOneAndDelete({ _id: req.params.id, createdBy: req.user.id });
    res.redirect("/profile");
});

// Admin routes

app.use("/admin", adminRoutes);
import issueRoutes from "./routes/issueRoutes.js";
app.use("/issues", issueRoutes);


// Server Listen
app.listen(3000, () => {
    console.log("Server running on port 3000");
});
