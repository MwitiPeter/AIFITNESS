const mongoose = require('mongoose');

const userProfileSchema = new mongoose.Schema({
  // Link to User
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // One profile per user
  },
  
  // Personal Details
  age: {
    type: Number,
    required: [true, 'Please add your age'],
    min: 13,
    max: 120
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  height: {
    value: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      enum: ['cm', 'inches'],
      default: 'cm'
    }
  },
  weight: {
    value: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      enum: ['kg', 'lbs'],
      default: 'kg'
    }
  },
  
  // Fitness Details
  fitnessLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    required: true
  },
  fitnessGoals: [{
    type: String,
    enum: [
      'weight_loss',
      'muscle_gain',
      'general_fitness',
      'endurance',
      'flexibility',
      'strength'
    ]
  }],
  
  // Medical/Safety Info
  injuries: {
    type: String,
    default: ''
  },
  medicalConditions: {
    type: String,
    default: ''
  },
  
  // Preferences
  workoutDuration: {
    type: Number, // in minutes
    default: 30
  },
  workoutsPerWeek: {
    type: Number,
    default: 3,
    min: 1,
    max: 7
  },
  equipment: [{
    type: String,
    enum: [
      'none',
      'dumbbells',
      'barbell',
      'resistance_bands',
      'pull_up_bar',
      'gym_access'
    ]
  }],
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('UserProfile', userProfileSchema);