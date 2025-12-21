const express = require('express');
const router = express.Router();
const {
  createOrUpdateProfile,
  getMyProfile,
  deleteProfile,
  checkProfileExists
} = require('../controllers/profileController');
const { protect } = require('../middleware/auth');

// All routes are protected (need authentication)
router.route('/')
  .post(protect, createOrUpdateProfile)
  .delete(protect, deleteProfile);

router.get('/me', protect, getMyProfile);
router.get('/check', protect, checkProfileExists);

module.exports = router;