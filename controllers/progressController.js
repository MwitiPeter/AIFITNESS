const WorkoutLog = require('../models/WorkoutLog');
const WorkoutPlan = require('../models/WorkoutPlan');

// @desc    Log a completed workout
// @route   POST /api/progress/log
// @access  Private
const logWorkout = async (req, res) => {
  try {
    const {
      workoutPlanId,
      dayOfWeek,
      exercisesCompleted,
      totalDuration,
      caloriesBurned,
      completed,
      completionPercentage,
      difficultyRating,
      notes,
      mood
    } = req.body;

    // Validation
    if (!workoutPlanId || !dayOfWeek || !totalDuration) {
      return res.status(400).json({
        success: false,
        message: 'Please provide required fields'
      });
    }

    // Verify workout plan exists and belongs to user
    const workoutPlan = await WorkoutPlan.findById(workoutPlanId);
    
    if (!workoutPlan) {
      return res.status(404).json({
        success: false,
        message: 'Workout plan not found'
      });
    }

    if (workoutPlan.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Create workout log
    const workoutLog = await WorkoutLog.create({
      user: req.user.id,
      workoutPlan: workoutPlanId,
      dayOfWeek,
      exercisesCompleted: exercisesCompleted || [],
      totalDuration,
      caloriesBurned: caloriesBurned || 0,
      completed: completed || false,
      completionPercentage: completionPercentage || 0,
      difficultyRating,
      notes,
      mood
    });

    res.status(201).json({
      success: true,
      message: 'Workout logged successfully',
      data: workoutLog
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error while logging workout'
    });
  }
};

// @desc    Get all workout logs for user
// @route   GET /api/progress/logs
// @access  Private
const getWorkoutLogs = async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;

    const workoutLogs = await WorkoutLog.find({ user: req.user.id })
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('workoutPlan', 'planName');

    const total = await WorkoutLog.countDocuments({ user: req.user.id });

    res.status(200).json({
      success: true,
      count: workoutLogs.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: workoutLogs
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching workout logs'
    });
  }
};

// @desc    Get workout logs by date range
// @route   GET /api/progress/logs/range
// @access  Private
const getWorkoutLogsByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide start and end dates'
      });
    }

    const workoutLogs = await WorkoutLog.find({
      user: req.user.id,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    })
      .sort({ date: -1 })
      .populate('workoutPlan', 'planName');

    res.status(200).json({
      success: true,
      count: workoutLogs.length,
      data: workoutLogs
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching workout logs'
    });
  }
};

// @desc    Get workout statistics
// @route   GET /api/progress/stats
// @access  Private
const getWorkoutStats = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - parseInt(days));

    const logs = await WorkoutLog.find({
      user: req.user.id,
      date: { $gte: dateThreshold }
    });

    // Calculate statistics
    const totalWorkouts = logs.length;
    const completedWorkouts = logs.filter(log => log.completed).length;
    const totalDuration = logs.reduce((sum, log) => sum + log.totalDuration, 0);
    const totalCalories = logs.reduce((sum, log) => sum + (log.caloriesBurned || 0), 0);
    const avgDuration = totalWorkouts > 0 ? totalDuration / totalWorkouts : 0;
    const avgCalories = totalWorkouts > 0 ? totalCalories / totalWorkouts : 0;
    const completionRate = totalWorkouts > 0 ? (completedWorkouts / totalWorkouts) * 100 : 0;

    // Calculate average difficulty rating
    const logsWithRating = logs.filter(log => log.difficultyRating);
    const avgDifficulty = logsWithRating.length > 0
      ? logsWithRating.reduce((sum, log) => sum + log.difficultyRating, 0) / logsWithRating.length
      : 0;

    res.status(200).json({
      success: true,
      data: {
        period: `Last ${days} days`,
        totalWorkouts,
        completedWorkouts,
        totalDuration: Math.round(totalDuration),
        totalCalories: Math.round(totalCalories),
        avgDuration: Math.round(avgDuration),
        avgCalories: Math.round(avgCalories),
        completionRate: Math.round(completionRate),
        avgDifficulty: Math.round(avgDifficulty * 10) / 10
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error while calculating stats'
    });
  }
};

module.exports = {
  logWorkout,
  getWorkoutLogs,
  getWorkoutLogsByDateRange,
  getWorkoutStats
};