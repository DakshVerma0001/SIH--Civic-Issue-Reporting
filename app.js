const express = require('express');
const userModel = require("./database/user");
const issueModel=require("./database/issues");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set("view engine", "ejs");

function isloggedin(req,res,next){
    const token=req.cookies.token;
    if(!token){
        return res.status(401).send("please login first");
    }
    const data=jwt.verify(token,"ndobhal");
    req.user=data;
    next();
}


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

 //  Agar role nahi diya, default set kar do
        if (!role || role.trim() === "") {
            role = "citizen";
        }

        // Check if user already exists
        let existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(400).send("User already exists");
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const createuser = await userModel.create({
            name,
            email,
            password: hashedPassword,
            role
        });

        // Successfully Register , now login
       res.redirect("/login");


});


//login
app.get("/login",function(req,res){
    res.render("login");
})

app.post("/login",async function(req,res){
    let{email,password}=req.body;
    //email exist 
    let userexist= await userModel.findOne({email});
    //if not exist
    if (!userexist) {
        return res.status(400).send("User not found!");
    }
        //continue 
        let checkuser=await bcrypt.compare(password,userexist.password);
          if (!checkuser) {
        return res.status(400).send("Invalid password!");
    }
            //generate jwt token
            const token=jwt.sign({email:userexist.email,id:userexist._id},
                "ndobhal",
                {expiresIn:"7d"}
            );

          res.cookie("token", token, {
            httpOnly: true,   //  cookie frontend JS se access nahi kar sakta
            secure: false,    //  localhost pe false, production me true
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        res.redirect("/profile");
    });

//logout
app.get("/logout",function(req,res){
  res.clearCookie("token", {
        httpOnly: true,
        secure: false
    });
    res.redirect("/login");
})

//profile
app.get("/profile",isloggedin,async function(req,res){
   try{
    const user=await userModel.findOne({email:req.user.email});
    if(!user){
        return res.redirect("/login");
    }
    res.render("profile",{user});
   } 
   catch(err){
     console.log("Profile Error:", err);
        res.status(500).send("Something went wrong!");
    }
});



//post
app.get("/post",function(req,res){
    res.render("post");
})

app.post("/post",isloggedin,async function(req,res){
const{title,description,location}=req.body;

//create issue
const newissue=await issueModel.create({
title,
description,
location,
createdBy:req.user.id
});


res.redirect("/profile");

})






// Server Listen
app.listen(3000, () => {
    console.log("Server running on port 3000");
});
