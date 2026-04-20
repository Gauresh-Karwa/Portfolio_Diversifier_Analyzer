const { Router } = require("express");
const { signup, login, getPortfolio, updatePortfolio } = require("../controllers/Authcontroller");
const { signupValidation, loginValidation } = require("../middlewares/Authvalidation");
const { verifyToken } = require("../middlewares/AuthMiddleware");

const router = Router();

router.post("/signup", signupValidation, signup);
router.post("/login", loginValidation, login);

// Protected routes
router.get("/profile", verifyToken, (req, res) => {
    res.status(200).json({
        success: true,
        user: req.user
    });
});

router.get("/portfolio", verifyToken, getPortfolio);
router.post("/portfolio", verifyToken, updatePortfolio);

module.exports = router;
