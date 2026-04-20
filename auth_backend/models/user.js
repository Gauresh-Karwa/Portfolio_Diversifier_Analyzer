const mongoose =require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true
    },
    investments:{
        type:String,
        default:""
    },
    age:{
        type:String,
        default:""
    },
    goal:{
        type:String,
        default:""
    }
})

const userModel =mongoose.model(`users`,UserSchema);
module.exports = userModel;