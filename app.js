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

const app = express();




// Route: reverse geocode API
app.get("/reverse-geocode", async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "lat and lon required" });

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1`;
    const resp = await axios.get(url, {
      headers: {
        "User-Agent": "SIH-CivicIssue/1.0 (mailto:your-email@example.com)" // 👈 apna email daalna
      },
      timeout: 5000
    });

    res.json(resp.data);
  } catch (err) {
    console.error("Nominatim error:", err.message);
    res.status(502).json({ error: "Reverse geocoding failed" });
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
        const user = await userModel.findById(req.user.id);
        if (!user) {
            return res.redirect("/login");
        }

        const issues = await issueModel.find({ createdBy: user._id });
        console.log("Rendering profile with data:", { user, issues });

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

// Register Page
app.get("/register", function (req, res) {
    res.render("register");
});

// Register User
app.post("/register", async function (req, res) {
    let { name, email, password, role } = req.body;

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
        role
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
      <p>Your civic issue has been posted successfully ✅</p>
      <ul>
        <li><strong>ID:</strong> ${newissue._id}</li>
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



// Server Listen
app.listen(3000, () => {
    console.log("Server running on port 3000");
});
