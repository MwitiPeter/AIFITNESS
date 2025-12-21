const mongoose = require('mongoose');

const workoutLogSchema = new mongoose.Schema({
  // Link to User and Workout Plan
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  workoutPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkoutPlan',
    required: true
  },
  
  // Workout Session Details
  date: {
    type: Date,
    default: Date.now
  },
  dayOfWeek: {
    type: String,
    required: true
  },
  
  // Exercises Completed
  exercisesCompleted: [{
    exerciseName: String,
    setsCompleted: Number,
    repsCompleted: [Number], // Array for each set
    weightUsed: Number,
    notes: String
  }],
  
  // Session Stats
  totalDuration: {
    type: Number, // in minutes
    required: true
  },
  caloriesBurned: Number,
  completed: {
    type: Boolean,
    default: false
  },
  completionPercentage: {
    type: Number,
    default: 0
  },
  
  // User Feedback
  difficultyRating: {
    type: Number,
    min: 1,
    max: 5
  },
  notes: String,
  mood: {
    type: String,
    enum: ['great', 'good', 'okay', 'tired', 'struggled']
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
workoutLogSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('WorkoutLog', workoutLogSchema);