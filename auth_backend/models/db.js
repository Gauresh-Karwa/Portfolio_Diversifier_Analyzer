const mongoose = require("mongoose");

const mongo_url=process.env.mongo_url;

mongoose.connect(mongo_url)
  .then(() => {
    console.log("mongodb connected");
  })
  .catch((err) => {
    console.log("mongodb error", err);
  });
