const userModel = require("../models/user");
const bcrypt=require('bcrypt');
const jwt =require("jsonwebtoken");
const { encryptData, decryptData } = require("../utils/encryption");

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

const getPortfolio = async (req, res) => {
    try {
        const user = await userModel.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: "User not found", success: false });
        }
        let parsedInvestments = [];
        try {
            if (user.investments && user.investments.includes(":")) {
                parsedInvestments = JSON.parse(decryptData(user.investments) || "[]");
            }
        } catch (e) {
            console.error("Failed to parse decrypted investments", e);
        }

        res.status(200).json({
            success: true,
            portfolio: {
                investments: parsedInvestments,
                age: user.age && user.age.includes(":") ? decryptData(user.age) : "",
                goal: user.goal && user.goal.includes(":") ? decryptData(user.goal) : ""
            }
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Internal server error", success: false });
    }
};

const updatePortfolio = async (req, res) => {
    try {
        const { investments, age, goal } = req.body;
        
        // Military-grade AES-256-GCM encryption before hitting MongoDB
        const encryptedInvestments = encryptData(JSON.stringify(investments || []));
        const encryptedAge = encryptData(age || "");
        const encryptedGoal = encryptData(goal || "");

        const user = await userModel.findByIdAndUpdate(
            req.user._id,
            { investments: encryptedInvestments, age: encryptedAge, goal: encryptedGoal },
            { new: true }
        );
        if (!user) {
            return res.status(404).json({ message: "User not found", success: false });
        }
        res.status(200).json({
            success: true,
            message: "Portfolio updated successfully"
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Internal server error", success: false });
    }
};

module.exports={
    signup, login, getPortfolio, updatePortfolio
}