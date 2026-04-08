const userModel = require("../models/user");
const bcrypt=require('bcrypt');
const jwt =require("jsonwebtoken");

const signup=async(req,res)=>{
    try{

        const{name,email,password}=req.body;
        const user=await userModel.findOne({email});

        if(user){
            return res.status(409)
            .json({message:"user already exist,you can login",success:false});
        }

        const usermodel=new userModel({name,email,password});
        usermodel.password=await bcrypt.hash(password,10);
        await usermodel.save();
        
        console.log("USER SAVED:", usermodel);

        res.status(201)
        .json({
            message:"signup succesfull",
            success:true
        })

    }catch(err){
        console.log(err);   // 👈 THIS IS KEY

        res.status(500)
        .json({
            message:"Internal server error",
            success:false
        })
        
    }
}
const login=async(req,res)=>{
    try{

        const{email,password}=req.body;
        const user=await userModel.findOne({email});
        const errmsg="Auth failed email or password is incorrect"
        if(!user){
            return res.status(403)
            .json({message:errmsg,success:false});
        }

        const ispassEqual=await bcrypt.compare(password,user.password);
        if(!ispassEqual){
            return res.status(403)
            .json({message:errmsg,success:false});
        }

        const jwtToken=jwt.sign(
            {email:user.email,_id:user._id},process.env.JWT_SECRET,{expiresIn:'24h'}
        )


        res.status(200)
        .json({
            message:"login succesfull",
            success:true,
            jwtToken,
            email,
            name:user.name

        })

    }catch(err){
        console.log(err);
        res.status(500)
        .json({
            message:"Internal server error",
            success:false
        })
        
    }
}

module.exports={
    signup,login
}