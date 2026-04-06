// Import mongoose to interact with MongoDB
const mongoose = require('mongoose');

const getDbStatus = () => mongoose.connection.readyState === 1;

// Function to connect to database
const connectDB = async () => {
  try {
    // Connect to MongoDB using connection string from .env
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    console.error('⚠️ Server will continue running, but database-dependent routes will be unavailable.');
  }
};

// Export so we can use in server.js
module.exports = {
  connectDB,
  getDbStatus
};