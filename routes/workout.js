const express = require('express');
const router = express.Router();
const {
  getWorkoutPlans,
  getActiveWorkoutPlan,
  getWorkoutPlanById,
  createWorkoutPlan,
  deleteWorkoutPlan,
  generateAIWorkoutPlan  // Add this import
} = require('../controllers/workoutController');
const { protect } = require('../middleware/auth');

// All routes are protected
router.route('/')
  .get(protect, getWorkoutPlans)
  .post(protect, createWorkoutPlan);

router.get('/active', protect, getActiveWorkoutPlan);

// Add this new route for AI generation
router.post('/generate', protect, generateAIWorkoutPlan);

router.route('/:id')
  .get(protect, getWorkoutPlanById)
  .delete(protect, deleteWorkoutPlan);

module.exports = router;