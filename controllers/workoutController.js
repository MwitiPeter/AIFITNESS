const { generateWorkoutPlan } = require('./aiService');
const WorkoutPlan = require('../models/WorkoutPlan');
const UserProfile = require('../models/UserProfile');
const WorkoutLog = require('../models/WorkoutLog');

// @desc    Get all workout plans for current user
// @route   GET /api/workouts
// @access  Private
const getWorkoutPlans = async (req, res) => {
  try {
    const workoutPlans = await WorkoutPlan.find({ user: req.user.id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: workoutPlans.length,
      data: workoutPlans
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching workout plans'
    });
  }
};

// @desc    Get active workout plan
// @route   GET /api/workouts/active
// @access  Private
const getActiveWorkoutPlan = async (req, res) => {
  try {
    const workoutPlan = await WorkoutPlan.findOne({
      user: req.user.id,
      isActive: true
    }).sort({ createdAt: -1 });

    if (!workoutPlan) {
      return res.status(404).json({
        success: false,
        message: 'No active workout plan found'
      });
    }

    res.status(200).json({
      success: true,
      data: workoutPlan
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching active workout plan'
    });
  }
};

// @desc    Get single workout plan by ID
// @route   GET /api/workouts/:id
// @access  Private
const getWorkoutPlanById = async (req, res) => {
  try {
    const workoutPlan = await WorkoutPlan.findById(req.params.id);

    if (!workoutPlan) {
      return res.status(404).json({
        success: false,
        message: 'Workout plan not found'
      });
    }

    // Make sure user owns this workout plan
    if (workoutPlan.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this workout plan'
      });
    }

    res.status(200).json({
      success: true,
      data: workoutPlan
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching workout plan'
    });
  }
};

// @desc    Create workout plan (we'll add AI generation in Phase 4)
// @route   POST /api/workouts
// @access  Private
const createWorkoutPlan = async (req, res) => {
  try {
    // Check if user has profile
    const profile = await UserProfile.findOne({ user: req.user.id });
    
    if (!profile) {
      return res.status(400).json({
        success: false,
        message: 'Please complete your profile first'
      });
    }

    const { planName, description, dailyWorkouts } = req.body;

    // Validation
    if (!planName || !dailyWorkouts || dailyWorkouts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide plan name and workouts'
      });
    }

    // Deactivate all previous plans
    await WorkoutPlan.updateMany(
      { user: req.user.id },
      { isActive: false }
    );

    // Create new workout plan
    const workoutPlan = await WorkoutPlan.create({
      user: req.user.id,
      planName,
      description,
      dailyWorkouts,
      difficultyLevel: profile.fitnessLevel,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: 'Workout plan created successfully',
      data: workoutPlan
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating workout plan'
    });
  }
};

// @desc    Delete workout plan
// @route   DELETE /api/workouts/:id
// @access  Private
const deleteWorkoutPlan = async (req, res) => {
  try {
    const workoutPlan = await WorkoutPlan.findById(req.params.id);

    if (!workoutPlan) {
      return res.status(404).json({
        success: false,
        message: 'Workout plan not found'
      });
    }

    // Make sure user owns this workout plan
    if (workoutPlan.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this workout plan'
      });
    }

    await workoutPlan.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Workout plan deleted successfully'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting workout plan'
    });
  }
};
const generateAIWorkoutPlan = async (req, res) => {
  try {
    // Check if user has profile
    const profile = await UserProfile.findOne({ user: req.user.id });
    
    if (!profile) {
      return res.status(400).json({
        success: false,
        message: 'Please complete your profile first before generating a workout plan'
      });
    }

    // Get user's workout history for personalization
    const workoutHistory = await WorkoutLog.find({ user: req.user.id })
      .sort({ date: -1 })
      .limit(10); // Last 10 workouts

    console.log('🤖 Generating AI workout plan for user:', req.user.id);

    // Generate workout plan using AI
    const aiResult = await generateWorkoutPlan(profile, workoutHistory);

    if (!aiResult.success) {
      console.log('⚠️ AI generation failed, using fallback plan');
    }

    // Deactivate all previous plans
    await WorkoutPlan.updateMany(
      { user: req.user.id },
      { isActive: false }
    );

    // Create workout plan in database
    const workoutPlan = await WorkoutPlan.create({
      user: req.user.id,
      planName: `${profile.fitnessLevel.charAt(0).toUpperCase() + profile.fitnessLevel.slice(1)} Workout Plan`,
      description: `Personalized ${profile.workoutsPerWeek}-day workout plan tailored to your fitness goals`,
      dailyWorkouts: aiResult.data,
      difficultyLevel: profile.fitnessLevel,
      generatedBy: 'AI',
      generationPrompt: aiResult.prompt,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: 'Workout plan generated successfully',
      aiUsed: aiResult.success,
      data: workoutPlan
    });

  } catch (error) {
    console.error('Generate Workout Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating workout plan'
    });
  }
};

module.exports = {
  getWorkoutPlans,
  getActiveWorkoutPlan,
  getWorkoutPlanById,
  createWorkoutPlan,
  deleteWorkoutPlan,
  generateAIWorkoutPlan  // Add this line
};