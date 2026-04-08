const { Router } = require("express");
const { signup, login } = require("../controllers/Authcontroller");
const { signupValidation, loginValidation } = require("../middlewares/Authvalidation");

const router = Router();

router.post("/signup", signupValidation, signup);
router.post("/login", loginValidation, login);

module.exports = router;
