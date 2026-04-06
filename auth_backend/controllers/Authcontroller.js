const db = require("../models/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");


// SIGNUP
const signup = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const [existingUser] = await db.query(
            "SELECT * FROM users WHERE email = ?",
            [email]
        );

        if (existingUser.length > 0) {
            return res.status(409).json({
                message: "User already exists",
                success: false
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            [name, email, hashedPassword]
        );

        res.status(201).json({
            message: "Signup successful",
            success: true
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            message: "Internal server error",
            success: false
        });
    }
};



// LOGIN
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const [rows] = await db.query(
            "SELECT * FROM users WHERE email = ?",
            [email]
        );

        const errmsg = "Email or password incorrect";

        if (rows.length === 0) {
            return res.status(403).json({
                message: errmsg,
                success: false
            });
        }

        const user = rows[0];

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(403).json({
                message: errmsg,
                success: false
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email
            },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        res.status(200).json({
            message: "Login successful",
            success: true,
            token,
            name: user.name
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            message: "Internal server error",
            success: false
        });
    }
};

module.exports = { signup, login };
