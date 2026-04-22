const mongoose = require('mongoose');
const uri = "mongodb://RohitDb:1Kt7O42U3wsBA0Ho@cluster0-shard-00-00.gc4rmx.mongodb.net:27017,cluster0-shard-00-01.gc4rmx.mongodb.net:27017,cluster0-shard-00-02.gc4rmx.mongodb.net:27017/?ssl=true&replicaSet=atlas-scxo5c-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(uri)
  .then(() => {
    console.log("Connected successfully to server");
    process.exit(0);
  })
  .catch(err => {
    console.log("Connection error", err);
    process.exit(1);
  });
