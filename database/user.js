const mongoose=require('mongoose');

//connect databse
mongoose.connect("mongodb://127.0.0.1:27017/civicissue");


//user schema
const userSchema= mongoose.Schema({
    name:{type:String,required:true},
    email:{type:String,required:true,unique:true},
    password:{type:String,required:true} ,
    profilepic:{
        type:String,
        default:"/images/uploads/default.jpg"
    },
role:{type:String,enum:['citizen','admin','authority'],default:"citizen"},
posts:[{
    type:mongoose.Schema.Types.ObjectId,
    ref:'issue'
}]
},{ timestamps:true});


//user tablle created
module.exports=mongoose.model("user",userSchema);