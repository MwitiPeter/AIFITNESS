const express = require('express');
const router = express.Router();
const {
  logWorkout,
  getWorkoutLogs,
  getWorkoutLogsByDateRange,
  getWorkoutStats
} = require('../controllers/progressController');
const { protect } = require('../middleware/auth');

// All routes are protected
router.post('/log', protect, logWorkout);
router.get('/logs', protect, getWorkoutLogs);
router.get('/logs/range', protect, getWorkoutLogsByDateRange);
router.get('/stats', protect, getWorkoutStats);

module.exports = router;