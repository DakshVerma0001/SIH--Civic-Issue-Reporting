const { required } = require("mongoose");
const mongoose=require("mongoose");

const issueSchema=mongoose.Schema({
title:{
    type:String,
     required: true
},
description:{
    type:String,
     required: true
},
image:{
    type:String
},
location:{
    type:String,
     required: true
},
 latitude: Number,
longitude: Number,

status:{
    type:String,
    enum:['Pending','In Progress','Resolved'],
    default:'Pending'
},

createdBy:{
 type:mongoose.Schema.Types.ObjectId,
 ref:'user',
 required:true
}
},{ timestamps: true });

module.exports=mongoose.model("issue",issueSchema);