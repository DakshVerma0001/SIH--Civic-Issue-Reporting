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

customId: { type: String, unique: true ,
    default: function() {
    return "CFI" + Math.floor(100000 + Math.random() * 900000);
  }
},
createdBy:{
 type:mongoose.Schema.Types.ObjectId,
 ref:'user',
 required:true
}
},{ timestamps: true });

// pre-save hook for CFU id
issueSchema.pre("save", function (next) {
  if (!this.customId) {
    this.customId = "CFU" + Math.floor(100000 + Math.random() * 900000); // CFU + 6 digit random
  }
  next();
});
module.exports=mongoose.model("issue",issueSchema);