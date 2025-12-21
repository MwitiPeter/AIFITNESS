const axios = require('axios');

// Hugging Face API configuration
const HF_API_URL = 'https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1';

/**
 * Generate workout plan using AI
 * @param {Object} userProfile - User's fitness profile
 * @param {Array} workoutHistory - User's past workout logs (for personalization)
 * @returns {Object} Generated workout plan
 */
const generateWorkoutPlan = async (userProfile, workoutHistory = []) => {
  try {
    // Build the AI prompt based on user data
    const prompt = buildWorkoutPrompt(userProfile, workoutHistory);

    // Call Hugging Face API
    const response = await axios.post(
      HF_API_URL,
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 2000,
          temperature: 0.7,
          top_p: 0.95,
          return_full_text: false
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Parse AI response
    const aiResponse = response.data[0].generated_text;
    
    // Convert AI text to structured workout plan
    const workoutPlan = parseAIResponse(aiResponse, userProfile);

    return {
      success: true,
      data: workoutPlan,
      prompt: prompt
    };

  } catch (error) {
    console.error('AI Service Error:', error.response?.data || error.message);
    
    // If AI fails, return a fallback basic plan
    return {
      success: false,
      error: error.message,
      data: getFallbackPlan(userProfile)
    };
  }
};

/**
 * Build AI prompt from user profile
 */
const buildWorkoutPrompt = (userProfile, workoutHistory) => {
  const { age, gender, height, weight, fitnessLevel, fitnessGoals, equipment, workoutDuration, workoutsPerWeek, injuries, medicalConditions } = userProfile;

  // Calculate BMI
  const heightInMeters = height.unit === 'cm' ? height.value / 100 : (height.value * 2.54) / 100;
  const weightInKg = weight.unit === 'kg' ? weight.value : weight.value * 0.453592;
  const bmi = (weightInKg / (heightInMeters * heightInMeters)).toFixed(1);

  // Analyze workout history
  let historyInsight = '';
  if (workoutHistory.length > 0) {
    const avgCompletion = workoutHistory.reduce((sum, log) => sum + log.completionPercentage, 0) / workoutHistory.length;
    const avgDifficulty = workoutHistory.filter(log => log.difficultyRating).reduce((sum, log) => sum + log.difficultyRating, 0) / workoutHistory.filter(log => log.difficultyRating).length || 3;
    
    historyInsight = `\nWorkout History Insight: The user has completed ${workoutHistory.length} workouts with an average completion rate of ${avgCompletion.toFixed(0)}%. They rated workouts an average difficulty of ${avgDifficulty.toFixed(1)}/5.`;
  }

  const prompt = `You are a professional fitness trainer. Create a personalized weekly workout plan.

User Profile:
- Age: ${age} years old
- Gender: ${gender}
- Height: ${height.value} ${height.unit}
- Weight: ${weight.value} ${weight.unit} (BMI: ${bmi})
- Fitness Level: ${fitnessLevel}
- Goals: ${fitnessGoals.join(', ')}
- Available Equipment: ${equipment.join(', ')}
- Preferred Workout Duration: ${workoutDuration} minutes
- Workouts Per Week: ${workoutsPerWeek}
${injuries ? `- Injuries/Limitations: ${injuries}` : ''}
${medicalConditions ? `- Medical Conditions: ${medicalConditions}` : ''}${historyInsight}

Create a ${workoutsPerWeek}-day workout plan. For each day, provide:
1. Day name (e.g., "Monday - Upper Body")
2. 5-7 exercises with:
   - Exercise name
   - Sets and reps
   - Brief instructions
   - Target muscles
   - Difficulty (easy/medium/hard)

Format each day clearly with exercise details. Keep it practical and safe for the user's fitness level.

Workout Plan:`;

  return prompt;
};

/**
 * Parse AI response into structured format
 */
const parseAIResponse = (aiText, userProfile) => {
  const lines = aiText.split('\n').filter(line => line.trim());
  const dailyWorkouts = [];
  let currentDay = null;
  let currentExercises = [];

  // Simple parsing logic
  for (let line of lines) {
    line = line.trim();
    
    // Detect day headers (e.g., "Day 1:", "Monday:", etc.)
    if (line.match(/^(Day\s+\d+|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i)) {
      // Save previous day if exists
      if (currentDay && currentExercises.length > 0) {
        dailyWorkouts.push({
          day: currentDay,
          exercises: currentExercises,
          totalDuration: userProfile.workoutDuration || 30,
          caloriesBurn: estimateCalories(currentExercises.length, userProfile.workoutDuration)
        });
      }
      
      // Start new day
      currentDay = line.replace(/^Day\s+\d+:\s*/i, '').replace(/:/g, '').trim();
      currentExercises = [];
    }
    // Detect exercises (lines with numbers, sets/reps, or exercise names)
    else if (line.match(/\d+\s+(sets|reps|x)/i) || line.match(/^\d+\./)) {
      const exercise = parseExerciseLine(line);
      if (exercise) {
        currentExercises.push(exercise);
      }
    }
  }

  // Add last day
  if (currentDay && currentExercises.length > 0) {
    dailyWorkouts.push({
      day: currentDay,
      exercises: currentExercises,
      totalDuration: userProfile.workoutDuration || 30,
      caloriesBurn: estimateCalories(currentExercises.length, userProfile.workoutDuration)
    });
  }

  // If parsing failed or not enough days, use fallback
  if (dailyWorkouts.length < userProfile.workoutsPerWeek) {
    return getFallbackPlan(userProfile);
  }

  return dailyWorkouts;
};

/**
 * Parse individual exercise line
 */
const parseExerciseLine = (line) => {
  // Remove numbering (1. 2. etc.)
  line = line.replace(/^\d+\.\s*/, '');

  // Extract sets and reps
  const setsMatch = line.match(/(\d+)\s*sets?/i);
  const repsMatch = line.match(/(\d+)(?:-(\d+))?\s*reps?/i);
  
  const sets = setsMatch ? parseInt(setsMatch[1]) : 3;
  const reps = repsMatch ? (repsMatch[2] ? `${repsMatch[1]}-${repsMatch[2]}` : repsMatch[1]) : '10-12';

  // Extract exercise name (everything before sets/reps)
  let name = line.split(/\d+\s*sets?/i)[0].trim();
  name = name.replace(/[-–—]/g, '').trim() || 'Exercise';

  return {
    name: name,
    sets: sets,
    reps: reps,
    duration: 0,
    restTime: 60,
    instructions: `Perform ${sets} sets of ${reps} reps with proper form`,
    targetMuscles: [],
    difficulty: 'medium'
  };
};

/**
 * Estimate calories burned
 */
const estimateCalories = (exerciseCount, duration) => {
  // Rough estimate: 5 calories per minute of exercise
  return Math.round(duration * 5);
};

/**
 * Fallback workout plan if AI fails
 */
const getFallbackPlan = (userProfile) => {
  const { fitnessLevel, workoutsPerWeek, fitnessGoals } = userProfile;

  const beginnerPlan = [
    {
      day: 'Day 1 - Full Body',
      exercises: [
        { name: 'Bodyweight Squats', sets: 3, reps: '10-12', restTime: 60, instructions: 'Stand with feet shoulder-width apart, lower down as if sitting in a chair', targetMuscles: ['legs', 'glutes'], difficulty: 'easy' },
        { name: 'Push-ups (knee or regular)', sets: 3, reps: '8-10', restTime: 60, instructions: 'Keep body straight, lower chest to ground', targetMuscles: ['chest', 'triceps'], difficulty: 'easy' },
        { name: 'Plank Hold', sets: 3, reps: '20-30 seconds', restTime: 45, instructions: 'Hold body in straight line, engage core', targetMuscles: ['core'], difficulty: 'easy' },
        { name: 'Walking Lunges', sets: 3, reps: '10 per leg', restTime: 60, instructions: 'Step forward, lower back knee toward ground', targetMuscles: ['legs', 'glutes'], difficulty: 'easy' },
        { name: 'Mountain Climbers', sets: 3, reps: '15-20', restTime: 45, instructions: 'From plank, drive knees toward chest alternating', targetMuscles: ['core', 'cardio'], difficulty: 'medium' }
      ],
      totalDuration: 30,
      caloriesBurn: 150
    },
    {
      day: 'Day 2 - Cardio & Core',
      exercises: [
        { name: 'Jumping Jacks', sets: 3, reps: '30 seconds', restTime: 30, instructions: 'Jump while spreading legs and raising arms', targetMuscles: ['full body', 'cardio'], difficulty: 'easy' },
        { name: 'Bicycle Crunches', sets: 3, reps: '15 per side', restTime: 45, instructions: 'Bring opposite elbow to knee in cycling motion', targetMuscles: ['core'], difficulty: 'easy' },
        { name: 'Burpees', sets: 3, reps: '8-10', restTime: 60, instructions: 'Squat, jump back to plank, return to squat, jump up', targetMuscles: ['full body'], difficulty: 'medium' },
        { name: 'Russian Twists', sets: 3, reps: '20 total', restTime: 45, instructions: 'Sit with feet elevated, twist torso side to side', targetMuscles: ['core'], difficulty: 'medium' },
        { name: 'High Knees', sets: 3, reps: '30 seconds', restTime: 30, instructions: 'Run in place bringing knees to hip level', targetMuscles: ['cardio', 'legs'], difficulty: 'easy' }
      ],
      totalDuration: 25,
      caloriesBurn: 180
    },
    {
      day: 'Day 3 - Lower Body',
      exercises: [
        { name: 'Squats', sets: 4, reps: '12-15', restTime: 60, instructions: 'Feet shoulder-width, sit back and down', targetMuscles: ['legs', 'glutes'], difficulty: 'easy' },
        { name: 'Glute Bridges', sets: 3, reps: '15', restTime: 45, instructions: 'Lie on back, lift hips while squeezing glutes', targetMuscles: ['glutes', 'hamstrings'], difficulty: 'easy' },
        { name: 'Calf Raises', sets: 3, reps: '20', restTime: 45, instructions: 'Stand on toes, lower back down slowly', targetMuscles: ['calves'], difficulty: 'easy' },
        { name: 'Wall Sit', sets: 3, reps: '30 seconds', restTime: 60, instructions: 'Slide back against wall until thighs parallel to ground', targetMuscles: ['legs'], difficulty: 'medium' },
        { name: 'Step-ups', sets: 3, reps: '10 per leg', restTime: 60, instructions: 'Step onto elevated surface, alternate legs', targetMuscles: ['legs', 'glutes'], difficulty: 'medium' }
      ],
      totalDuration: 30,
      caloriesBurn: 160
    }
  ];

  // Return only the number of days requested
  return beginnerPlan.slice(0, workoutsPerWeek);
};

module.exports = {
  generateWorkoutPlan
};