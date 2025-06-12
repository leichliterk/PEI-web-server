
const mongoose = require('mongoose');
// const uri = MONGODB_URI = `mongodb+srv://api_user:fkv2ygk3HTE@xbn8zxr@cluster0.zf8h7c3.mongodb.net/${process.env.STAGING ? "staging" : "production"}`;
const uri = `mongodb+srv://api_user:5ZKBbw9YBgFKb4uz@cluster0.zf8h7c3.mongodb.net/${process.env.STAGING ? "staging" : "production"}`;

const clientOptions = { serverApi: { version: '1', strict: true, deprecationErrors: true } };

async function connectToMongo() {
  try {
    // Create a Mongoose client with a MongoClientOptions object to set the Stable API version
    await mongoose.connect(uri, clientOptions);
    await mongoose.connection.db.admin().command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await mongoose.disconnect();
  }
}





module.exports = connectToMongo;