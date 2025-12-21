const mongoose = require('mongoose');

const workoutPlanSchema = new mongoose.Schema({
  // Link to User
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Plan Details
  planName: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  
  // Daily Workouts Array
  dailyWorkouts: [{
    day: {
      type: String,
      required: true
    },
    exercises: [{
      name: {
        type: String,
        required: true
      },
      sets: Number,
      reps: String, // Can be "10" or "10-12" or "30 seconds"
      duration: Number, // in seconds
      restTime: Number, // in seconds
      instructions: String,
      targetMuscles: [String],
      difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard']
      }
    }],
    totalDuration: Number, // Total workout time in minutes
    caloriesBurn: Number // Estimated calories
  }],
  
  // Plan Metadata
  totalWeeks: {
    type: Number,
    default: 4
  },
  difficultyLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced']
  },
  
  // AI Generation Info
  generatedBy: {
    type: String,
    default: 'AI'
  },
  generationPrompt: String, // Store what we asked the AI
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('WorkoutPlan', workoutPlanSchema);