const express = require('express');
const userModel = require("./database/user");
const issueModel = require("./database/issues");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const AWS=require("aws-sdk");
const fs = require("fs");
const axios = require("axios");
const sendMail = require("./utils/mailHelper");
// Multer setup

const multerS3 = require("multer-s3");
require("dotenv").config();
if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET is missing. Set it in .env");
  process.exit(1);
}

// temporary in-memory store for OTPs (dev only)
const emailOtpStore = {}; // { "<email>": { otp: "123456", expiresAt: Date } }
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

const verifiedEmails = {}; // { "<email>": timestampUntilValid }
const VERIFIED_TTL_MS = 10 * 60 * 1000; // 10 minutes window to complete registration after verification


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


AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();


// ----------------- LOGIN -----------------
app.post("/login", async function (req, res) {
    let { email, password } = req.body;

    let userexist = await userModel.findOne({ email });
    if (!userexist) {
        return res.status(400).send("User not found!");
    }

    let checkuser = await bcrypt.compare(password, userexist.password);
    if (!checkuser) {
        return res.status(400).send("Invalid password!");
    }

    const token = jwt.sign(
        { email: userexist.email, id: userexist._id },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );

    res.cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.redirect("/profile");
});

// ----------------- PROFILE -----------------
app.get("/profile", isloggedin, async function (req, res) {
    try {
        const user = await userModel.findOne({_id:req.user.id});
        if (!user) {
            return res.redirect("/login");
        }

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

const upload = multer({ storage: storage });

// Homepage
app.get("/", function (req, res) {
    res.render("index");
});

// Send OTP to email
app.post("/send-email-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, msg: "Email required" });

    // generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // store OTP with expiry
    emailOtpStore[email] = {
      otp,
      expiresAt: Date.now() + OTP_TTL_MS
    };

    // send OTP by email using your sendMail helper
    const html = `<p>Your verification OTP is <strong>${otp}</strong>. It will expire in 5 minutes.</p>`;
    await sendMail(email, "Your verification OTP", html);

    console.log("Email OTP sent:", email, otp); // useful for dev
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

    if (Date.now() > record.expiresAt) {
      delete emailOtpStore[email];
      return res.status(400).json({ success: false, msg: "OTP expired" });
    }

    if (record.otp !== otp.toString()) {
      return res.status(400).json({ success: false, msg: "Invalid OTP" });
    }

    //  ✅ Mark as verified
    verifiedEmails[email] = Date.now() + VERIFIED_TTL_MS;

    delete emailOtpStore[email];

    return res.json({ success: true, msg: "Email verified" });
  } catch (err) {
    console.error("verify-email-otp error:", err);
    return res.status(500).json({ success: false, msg: "Verification failed" });
  }
});


// Register Page
app.get("/register", function (req, res) {
    res.render("register");
});

// Register User
app.post("/register", async function (req, res) {
    let { name, email, password, confirmpassword,role ,phone,latitude,longitude,address} = req.body;

    // before creating user
if (!verifiedEmails[email] || Date.now() > verifiedEmails[email]) {
  return res.status(400).send("Please verify your email before registering");
}

// optionally delete it after use:
delete verifiedEmails[email];

    if (password !== confirmpassword) {
        return res.status(400).send("Passwords do not match!");
    }

    if (!role || role.trim() === "") {
        role = "citizen";
    }



    let existingUser = await userModel.findOne({ email });
    if (existingUser) {
        return res.status(400).send("User already exists");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await userModel.create({
        name,
        email,
        password: hashedPassword,
        role,
         phone,
        address,
        latitude,
        longitude
    });

    res.redirect("/login");
});

// Login Page
app.get("/login", function (req, res) {
    res.render("login");
});

// Logout
app.get("/logout", function (req, res) {
    res.clearCookie("token", {
        httpOnly: true,
        secure: false
    });
    res.redirect("/login");
});

// Post issue page
app.get("/post", isloggedin, function (req, res) {
    res.render("post");
});

// Post issue handler
app.post("/post", isloggedin, upload.single("image"), async function (req, res) {
    let { title, description, location ,latitude, longitude,manualLocation } = req.body;

        // Agar auto-location fail ho gayi → manual wali use karo
    if (!location || location.trim() === "") {
      location = manualLocation || "Unknown Location";
    }

    if (!title || !description || !location) {
        return res.status(400).send("please fill all the required fields");
    }

    const newissue = await issueModel.create({
        title,
        description,
        location,
        latitude:latitude || null,
        longitude:longitude || null,
   image: req.file ? req.file.location : null, 
        createdBy: req.user.id
    });
    
    // ✅ mail bhejne ke liye user fetch karo
    const user = await userModel.findById(req.user.id);

    // Maps link
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
    const issueUrl = `${process.env.BASE_URL}/issue/${newissue._id}`;

    // ✅ Mail ka HTML
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

    // ✅ mail bhejo
    await sendMail(user.email, `Issue Received — ID: ${newissue._id}`, html);


    res.redirect("/profile");
    
});

// Single issue page
app.get("/issue/:id", isloggedin, async (req, res) => {
  try {
    const issue = await issueModel.findById(req.params.id).populate("createdBy", "name email");
    if (!issue) return res.status(404).send("Issue not found");

    res.render("issue", { issue });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading issue");
  }
});

//edit profile
app.get("/profile/edit",isloggedin,async function(req,res){
    const user=await userModel.findById(req.user.id);
    res.render("editprofile",{user});
});

//handle edit profile form
app.post("/profile/edit",isloggedin,upload.single("profilepic"),async function(req,res){
    try{
        const {name,email}=req.body;
let updatedata={name,email};

//if new pic uploaded
if(req.file){
updatedata.profilepic=req.file.location;
}
await userModel.findByIdAndUpdate(req.user.id,updatedata,{new:true})
res.redirect("/profile");
    }
    catch(err){
        console.log(err);
        if(err.code === 11000){
            return res.status(400).send("email already exists");
        }
      res.status(500).send("could not update profile");

    }
})

//show egit issue form
app.get("/issue/edit/:id", isloggedin, async (req, res) => {
  try {
    const issue = await issueModel.findById(req.params.id);

    if (!issue) {
      return res.status(404).send("Issue not found");
    }

    // safe check
    if (!issue.createdBy || issue.createdBy.toString() !== req.user.id) {
      return res.status(403).send("Not authorized");
    }

    res.render("editIssue", { issue });
  } catch (err) {
    console.error("Edit issue error:", err);
    res.status(500).send("Server error");
  }
});

// Handle edit submit
app.post("/issue/edit/:id", isloggedin, async (req, res) => {
  const { title, description, manualLocation } = req.body;
  await issueModel.findOneAndUpdate(
    { _id: req.params.id, createdBy: req.user.id },
    { title, description, location: manualLocation }
  );
  res.redirect("/profile");
});

// Delete issue
app.post("/issue/delete/:id", isloggedin, async (req, res) => {
  await issueModel.findOneAndDelete({ _id: req.params.id, createdBy: req.user.id });
  res.redirect("/profile");
});


// Server Listen
app.listen(3000, () => {
    console.log("Server running on port 3000");
});
