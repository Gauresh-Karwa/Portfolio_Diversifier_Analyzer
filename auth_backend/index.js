const express = require("express");
const app = express();
require("dotenv").config();

// DB connection
require("./models/db");

const cors = require("cors");
const authRouter = require("./routes/authRouter");

const PORT = process.env.PORT || 8080;


// Middlewares
app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Routes
app.use("/auth", authRouter);

app.get("/home", (req, res) => {
  res.send("Server is running ✅");
});


// Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
