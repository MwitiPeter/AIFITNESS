// Import mongoose to interact with MongoDB
const mongoose = require('mongoose');

// Function to connect to database
const connectDB = async () => {
  try {
    // Connect to MongoDB using connection string from .env
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1); // Exit if connection fails
  }
};

// Export so we can use in server.js
module.exports = connectDB;