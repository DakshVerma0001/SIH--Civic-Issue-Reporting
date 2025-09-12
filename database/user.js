const mongoose=require('mongoose');

//connect databse
mongoose.connect("mongodb://127.0.0.1:27017/civicissue");


//user schema
const userSchema= mongoose.Schema({
    customId: { type: String, unique: true }, // CFU prefixed ID
    name:{type:String,required:true},
    email:{type:String,required:true,unique:true},
    password:{type:String,required:true} ,
    profilepic:{
        type:String,
        default:"/images/uploads/default.jpg"
    },
    phone:{type: String},
  address:{type: String},
  latitude:{type: String},
  longitude: {type: String},
role:{type:String,enum:['citizen','admin','authority'],default:"citizen"},
posts:[{
    type:mongoose.Schema.Types.ObjectId,
    ref:'issue'
}]
},{ timestamps:true});


// pre-save hook for CFU id
userSchema.pre("save", function (next) {
  if (!this.customId) {
    this.customId = "CFU" + Math.floor(100000 + Math.random() * 900000); // CFU + 6 digit random
  }
  next();
});

//user tablle created
module.exports=mongoose.model("user",userSchema);