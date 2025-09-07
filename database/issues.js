const { required } = require("joi");
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
status:{
    type:String,
    enum:['Pending','In Progress','Resolved'],
    default:'Pending'
},
likes:[{    //array because bhot sare logo ne like kre hounge apne apni id se.
    type:mongoose.Schema.Types.ObjectId,
    ref:'user'
}],
createdBy:{
 type:mongoose.Schema.Types.ObjectId,
 ref:'user',
 required:true
}
},{ timestamps: true });

module.exports=mongoose.model("issue",issueSchema);