const UserProfile = require('../models/UserProfile');
const User = require('../models/User');

// @desc    Create or Update user profile
// @route   POST /api/profile
// @access  Private
const createOrUpdateProfile = async (req, res) => {
  try {
    const {
      age,
      gender,
      height,
      weight,
      fitnessLevel,
      fitnessGoals,
      injuries,
      medicalConditions,
      workoutDuration,
      workoutsPerWeek,
      equipment
    } = req.body;

    // Validation
    if (!age || !gender || !height || !weight || !fitnessLevel) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Build profile object
    const profileFields = {
      user: req.user.id,
      age,
      gender,
      height,
      weight,
      fitnessLevel,
      fitnessGoals: fitnessGoals || [],
      injuries: injuries || '',
      medicalConditions: medicalConditions || '',
      workoutDuration: workoutDuration || 30,
      workoutsPerWeek: workoutsPerWeek || 3,
      equipment: equipment || ['none'],
      updatedAt: Date.now()
    };

    // Check if profile exists
    let profile = await UserProfile.findOne({ user: req.user.id });

    if (profile) {
      // Update existing profile
      profile = await UserProfile.findOneAndUpdate(
        { user: req.user.id },
        { $set: profileFields },
        { new: true, runValidators: true }
      ).populate('user', 'name email');

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: profile
      });
    }

    // Create new profile
    profile = await UserProfile.create(profileFields);
    
    // Populate user info
    profile = await UserProfile.findById(profile._id).populate('user', 'name email');

    res.status(201).json({
      success: true,
      message: 'Profile created successfully',
      data: profile
    });

  } catch (error) {
    console.error(error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while creating/updating profile'
    });
  }
};

// @desc    Get current user's profile
// @route   GET /api/profile/me
// @access  Private
const getMyProfile = async (req, res) => {
  try {
    const profile = await UserProfile.findOne({ user: req.user.id })
      .populate('user', 'name email');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found. Please complete your profile setup.'
      });
    }

    res.status(200).json({
      success: true,
      data: profile
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile'
    });
  }
};

// @desc    Delete user profile
// @route   DELETE /api/profile
// @access  Private
const deleteProfile = async (req, res) => {
  try {
    const profile = await UserProfile.findOne({ user: req.user.id });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    await profile.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Profile deleted successfully'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting profile'
    });
  }
};

// @desc    Check if user has completed profile
// @route   GET /api/profile/check
// @access  Private
const checkProfileExists = async (req, res) => {
  try {
    const profile = await UserProfile.findOne({ user: req.user.id });

    res.status(200).json({
      success: true,
      hasProfile: !!profile,
      data: profile ? { fitnessLevel: profile.fitnessLevel } : null
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking profile'
    });
  }
};

module.exports = {
  createOrUpdateProfile,
  getMyProfile,
  deleteProfile,
  checkProfileExists
};