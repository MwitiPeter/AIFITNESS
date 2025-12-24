const axios = require('axios');

// Hugging Face API configuration
const HF_API_URL = 'https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1';

/**
 * Generate workout plan using AI with DETAILED exercise instructions
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
          max_new_tokens: 3000, // INCREASED for detailed instructions
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
 * Build ENHANCED AI prompt with detailed instruction requirements
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
    
    historyInsight = `\nWorkout History: User completed ${workoutHistory.length} workouts with ${avgCompletion.toFixed(0)}% average completion rate. Average difficulty rating: ${avgDifficulty.toFixed(1)}/5.`;
  }

  const prompt = `You are a professional fitness trainer creating a personalized workout plan. Provide DETAILED exercise instructions that are beginner-friendly and safe.

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

Create a ${workoutsPerWeek}-day workout plan. For EACH exercise, provide:

1. Exercise name
2. Sets and reps (e.g., "3 sets of 10-12 reps")
3. Rest time (e.g., 60 seconds)

4. DETAILED STEP-BY-STEP INSTRUCTIONS (4-6 steps):
   - Number each step clearly
   - Include body positioning, movement pattern, and key form cues
   - Be specific and clear for beginners

5. PRIMARY MUSCLES worked (list 2-3 main muscle groups)

6. CORRECT FORM TIPS (2-3 "do this" tips):
   - What the user SHOULD do for proper form

7. COMMON MISTAKES to avoid (2-3 mistakes):
   - What the user should NOT do

8. BREATHING TECHNIQUE:
   - When to inhale and when to exhale during the movement

9. EASIER VERSION (for beginners):
   - How to modify the exercise to make it easier

10. HARDER VERSION (for advanced):
    - How to make the exercise more challenging

11. SAFETY NOTE:
    - Important safety considerations

Format each exercise clearly with labels like:
- STEP-BY-STEP:
- MUSCLES:
- DO THIS:
- AVOID THIS:
- BREATHING:
- EASIER:
- HARDER:
- SAFETY:

Create practical exercises appropriate for ${fitnessLevel} level with ${equipment.join(', ')} equipment. Keep the workout safe, effective, and achievable in ${workoutDuration} minutes per session.

Workout Plan:`;

  return prompt;
};

/**
 * Parse AI response into structured format with detailed instructions
 */
const parseAIResponse = (aiText, userProfile) => {
  const lines = aiText.split('\n').filter(line => line.trim());
  const dailyWorkouts = [];
  let currentDay = null;
  let currentExercises = [];
  let currentExercise = null;

  for (let line of lines) {
    line = line.trim();
    
    // Detect day headers
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
      currentExercise = null;
    }
    // Detect new exercise (numbered line or clear exercise name)
    else if (line.match(/^\d+\.\s+\w+/) || (line.length < 50 && line.match(/^[A-Z]/))) {
      // Save previous exercise if exists
      if (currentExercise) {
        currentExercises.push(currentExercise);
      }
      
      // Start new exercise
      const exerciseName = line.replace(/^\d+\.\s*/, '').split('-')[0].trim();
      currentExercise = {
        name: exerciseName,
        sets: 3,
        reps: '10-12',
        duration: 0,
        restTime: 60,
        instructions: '',
        stepByStep: [],
        targetMuscles: [],
        correctForm: [],
        commonMistakes: [],
        breathing: '',
        easierVersion: '',
        harderVersion: '',
        safetyNote: '',
        difficulty: 'medium'
      };
    }
    // Parse detailed sections
    else if (currentExercise) {
      const lowerLine = line.toLowerCase();
      
      // Extract sets/reps
      if (line.match(/(\d+)\s*sets?\s+(?:of\s+)?(\d+(?:-\d+)?)\s*reps?/i)) {
        const match = line.match(/(\d+)\s*sets?\s+(?:of\s+)?(\d+(?:-\d+)?)\s*reps?/i);
        currentExercise.sets = parseInt(match[1]);
        currentExercise.reps = match[2];
      }
      
      // Parse step-by-step instructions
      if (lowerLine.includes('step-by-step') || lowerLine.includes('steps:')) {
        // Next lines are steps
        continue;
      } else if (line.match(/^\d+[\.)]\s+/)) {
        currentExercise.stepByStep.push(line.replace(/^\d+[\.)]\s+/, ''));
      }
      
      // Parse muscles
      if (lowerLine.includes('muscles:') || lowerLine.includes('primary muscles')) {
        currentExercise.targetMuscles = line.split(':')[1]?.split(',').map(m => m.trim()) || [];
      }
      
      // Parse correct form
      if (lowerLine.includes('do this:') || lowerLine.includes('correct form')) {
        const tips = line.split(':')[1];
        if (tips) currentExercise.correctForm.push(tips.trim());
      } else if (currentExercise.correctForm.length > 0 && line.startsWith('-')) {
        currentExercise.correctForm.push(line.substring(1).trim());
      }
      
      // Parse mistakes
      if (lowerLine.includes('avoid this:') || lowerLine.includes('common mistakes') || lowerLine.includes('don\'t')) {
        const mistakes = line.split(':')[1];
        if (mistakes) currentExercise.commonMistakes.push(mistakes.trim());
      } else if (currentExercise.commonMistakes.length > 0 && line.startsWith('-')) {
        currentExercise.commonMistakes.push(line.substring(1).trim());
      }
      
      // Parse breathing
      if (lowerLine.includes('breathing:')) {
        currentExercise.breathing = line.split(':')[1]?.trim() || '';
      }
      
      // Parse easier version
      if (lowerLine.includes('easier:') || lowerLine.includes('beginner')) {
        currentExercise.easierVersion = line.split(':')[1]?.trim() || line;
      }
      
      // Parse harder version
      if (lowerLine.includes('harder:') || lowerLine.includes('advanced')) {
        currentExercise.harderVersion = line.split(':')[1]?.trim() || line;
      }
      
      // Parse safety
      if (lowerLine.includes('safety:')) {
        currentExercise.safetyNote = line.split(':')[1]?.trim() || '';
      }
      
      // Build combined instructions from all parts
      if (currentExercise.stepByStep.length > 0) {
        currentExercise.instructions = '📋 STEPS: ' + currentExercise.stepByStep.join(' → ') + 
          (currentExercise.targetMuscles.length > 0 ? '. 💪 MUSCLES: ' + currentExercise.targetMuscles.join(', ') : '') +
          (currentExercise.breathing ? '. 🫁 BREATHING: ' + currentExercise.breathing : '') +
          (currentExercise.correctForm.length > 0 ? '. ✅ DO: ' + currentExercise.correctForm.join('; ') : '') +
          (currentExercise.commonMistakes.length > 0 ? '. ❌ AVOID: ' + currentExercise.commonMistakes.join('; ') : '');
      }
    }
  }

  // Save last exercise and day
  if (currentExercise) {
    currentExercises.push(currentExercise);
  }
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
 * Estimate calories burned
 */
const estimateCalories = (exerciseCount, duration) => {
  return Math.round(duration * 5);
};

/**
 * Enhanced fallback workout plan with detailed instructions
 */
const getFallbackPlan = (userProfile) => {
  const { fitnessLevel, workoutsPerWeek } = userProfile;

  const detailedExercises = {
    pushups: {
      name: 'Push-ups',
      sets: 3,
      reps: '10-12',
      restTime: 60,
      instructions: '📋 STEPS: 1) Start in high plank position with hands shoulder-width apart. 2) Keep core engaged and body in straight line. 3) Lower chest to floor (2 seconds), elbows at 45° angle. 4) Push back up explosively (1 second). 💪 MUSCLES: Chest, Triceps, Shoulders, Core. 🫁 BREATHING: Inhale down, exhale up. ✅ DO: Keep body straight, engage core, controlled movement. ❌ AVOID: Sagging hips, flared elbows, holding breath. ⚡ EASIER: On knees or against wall. 🔥 HARDER: Feet elevated or add clap.',
      targetMuscles: ['Chest', 'Triceps', 'Shoulders', 'Core'],
      difficulty: 'easy',
      stepByStep: [
        'Start in high plank position with hands shoulder-width apart',
        'Keep core engaged and body in straight line from head to heels',
        'Lower your chest to floor slowly (2 seconds), elbows at 45° angle',
        'Push explosively back to start position (1 second)',
        'Repeat maintaining perfect form throughout'
      ],
      correctForm: ['Keep body in straight line', 'Engage core throughout', 'Controlled tempo'],
      commonMistakes: ['Sagging hips', 'Flared elbows', 'Holding breath'],
      breathing: 'Inhale as you lower, exhale as you push up',
      easierVersion: 'Do on knees or with hands elevated on bench/wall',
      harderVersion: 'Elevate feet, add clap, or try one-arm push-ups',
      safetyNote: 'Stop if you feel sharp pain in shoulders or wrists'
    },
    squats: {
      name: 'Bodyweight Squats',
      sets: 3,
      reps: '12-15',
      restTime: 60,
      instructions: '📋 STEPS: 1) Stand with feet shoulder-width apart, toes slightly out. 2) Keep chest up and core engaged. 3) Sit back and down like sitting in a chair. 4) Lower until thighs parallel to floor. 5) Push through heels to stand. 💪 MUSCLES: Quads, Glutes, Hamstrings, Core. 🫁 BREATHING: Inhale down, exhale up. ✅ DO: Chest up, weight in heels, knees track over toes. ❌ AVOID: Knees caving in, rounding back, lifting heels. ⚡ EASIER: Partial range or hold onto support. 🔥 HARDER: Add jump or single-leg.',
      targetMuscles: ['Quadriceps', 'Glutes', 'Hamstrings'],
      difficulty: 'easy',
      stepByStep: [
        'Stand with feet shoulder-width apart, toes slightly pointed out',
        'Keep chest up, shoulders back, and core engaged',
        'Sit back and down as if sitting in a chair',
        'Lower until thighs are parallel to floor (or as low as comfortable)',
        'Push through heels to return to standing position'
      ],
      correctForm: ['Chest up throughout', 'Weight in heels', 'Knees track over toes'],
      commonMistakes: ['Knees caving inward', 'Rounding back', 'Lifting heels off ground'],
      breathing: 'Inhale as you lower, exhale as you stand',
      easierVersion: 'Reduce range of motion or hold onto wall for support',
      harderVersion: 'Add jump at top or try single-leg squats',
      safetyNote: 'Keep back straight and avoid knee pain'
    },
    plank: {
      name: 'Plank Hold',
      sets: 3,
      reps: '30 seconds',
      restTime: 45,
      instructions: '📋 STEPS: 1) Start on forearms and toes. 2) Keep body in straight line from head to heels. 3) Engage core, squeeze glutes. 4) Hold position without sagging or piking. 💪 MUSCLES: Core, Shoulders, Back. 🫁 BREATHING: Breathe steadily throughout. ✅ DO: Straight body line, tight core, neutral neck. ❌ AVOID: Sagging hips, piking up, holding breath. ⚡ EASIER: On knees or shorter duration. 🔥 HARDER: Lift one leg or arm.',
      targetMuscles: ['Core', 'Shoulders', 'Lower Back'],
      difficulty: 'easy',
      stepByStep: [
        'Start in forearm plank position - elbows under shoulders',
        'Keep body in straight line from head to heels',
        'Engage your core and squeeze your glutes',
        'Look at floor to keep neck neutral',
        'Hold position steady without sagging or piking up'
      ],
      correctForm: ['Body in straight line', 'Core engaged', 'Breathe steadily'],
      commonMistakes: ['Hips sagging down', 'Butt piking up', 'Holding breath'],
      breathing: 'Breathe normally and steadily throughout the hold',
      easierVersion: 'Do on knees or hold for shorter duration (15-20 seconds)',
      harderVersion: 'Lift one leg, lift one arm, or add shoulder taps',
      safetyNote: 'Stop if you feel lower back pain - focus on core engagement'
    }
  };

  const beginnerPlan = [
    {
      day: 'Day 1 - Full Body',
      exercises: [
        detailedExercises.squats,
        detailedExercises.pushups,
        detailedExercises.plank,
        {
          name: 'Walking Lunges',
          sets: 3,
          reps: '10 per leg',
          restTime: 60,
          instructions: '📋 STEPS: 1) Stand tall, step forward with one leg. 2) Lower back knee toward floor. 3) Front thigh parallel to floor. 4) Push through front heel to step forward with other leg. 💪 MUSCLES: Legs, Glutes, Core. 🫁 BREATHING: Inhale down, exhale up. ✅ DO: Long step, knee at 90°, chest up. ❌ AVOID: Short steps, knee past toes, leaning forward.',
          targetMuscles: ['Quadriceps', 'Glutes', 'Hamstrings'],
          difficulty: 'easy',
          stepByStep: ['Stand tall', 'Step forward with one leg', 'Lower back knee', 'Push through front heel', 'Alternate legs'],
          correctForm: ['Long stride', '90° knee angle', 'Chest upright'],
          commonMistakes: ['Too short steps', 'Knee past toes', 'Leaning forward'],
          breathing: 'Inhale as you lower, exhale as you stand',
          easierVersion: 'Hold wall for balance or reduce range of motion',
          harderVersion: 'Add dumbbells or do jumping lunges',
          safetyNote: 'Keep front knee aligned with ankle'
        },
        {
          name: 'Mountain Climbers',
          sets: 3,
          reps: '15-20',
          restTime: 45,
          instructions: '📋 STEPS: 1) Start in high plank position. 2) Drive one knee toward chest. 3) Quickly switch legs in running motion. 4) Keep hips low and core tight. 💪 MUSCLES: Core, Shoulders, Cardio. 🫁 BREATHING: Quick rhythm with movement. ✅ DO: Fast pace, hips low, core engaged. ❌ AVOID: Hips too high, slow pace, sagging form.',
          targetMuscles: ['Core', 'Shoulders', 'Hip Flexors'],
          difficulty: 'medium',
          stepByStep: ['Start in plank', 'Drive knee to chest', 'Switch legs quickly', 'Keep core engaged', 'Maintain rhythm'],
          correctForm: ['Fast alternating pace', 'Hips stay low', 'Core stays tight'],
          commonMistakes: ['Hips too high', 'Too slow', 'Losing plank form'],
          breathing: 'Quick breaths matching your movement rhythm',
          easierVersion: 'Slow the pace down or reduce range of motion',
          harderVersion: 'Increase speed or bring knees to opposite elbow',
          safetyNote: 'Maintain plank form throughout - stop if form breaks'
        }
      ],
      totalDuration: 30,
      caloriesBurn: 150
    },
    {
      day: 'Day 2 - Cardio & Core',
      exercises: [
        {
          name: 'Jumping Jacks',
          sets: 3,
          reps: '30 seconds',
          restTime: 30,
          instructions: '📋 STEPS: 1) Stand with feet together, arms at sides. 2) Jump while spreading legs and raising arms overhead. 3) Jump back to starting position. 4) Keep pace steady and rhythmic. 💪 MUSCLES: Full body, Cardio. 🫁 BREATHING: Rhythmic with jumps. ✅ DO: Full range, soft landings, steady pace. ❌ AVOID: Stiff landings, irregular rhythm.',
          targetMuscles: ['Full Body', 'Cardiovascular'],
          difficulty: 'easy',
          stepByStep: ['Start with feet together', 'Jump spreading legs wide', 'Raise arms overhead', 'Jump back to start', 'Maintain rhythm'],
          correctForm: ['Full range of motion', 'Soft landings', 'Steady pace'],
          commonMistakes: ['Landing too hard', 'Irregular pace', 'Incomplete range'],
          breathing: 'Breathe rhythmically with your jumping pattern',
          easierVersion: 'Step side to side instead of jumping',
          harderVersion: 'Increase speed or add squat at bottom',
          safetyNote: 'Land softly to protect knees and joints'
        },
        {
          name: 'Bicycle Crunches',
          sets: 3,
          reps: '15 per side',
          restTime: 45,
          instructions: '📋 STEPS: 1) Lie on back, hands behind head. 2) Bring opposite elbow to opposite knee. 3) Extend other leg straight. 4) Switch sides in cycling motion. 5) Keep lower back pressed to floor. 💪 MUSCLES: Core, Obliques. 🫁 BREATHING: Exhale as you twist. ✅ DO: Controlled twist, lower back down, full rotation. ❌ AVOID: Pulling neck, rushing movement, lifting lower back.',
          targetMuscles: ['Abs', 'Obliques', 'Hip Flexors'],
          difficulty: 'easy',
          stepByStep: ['Lie on back, hands behind head', 'Bring elbow to opposite knee', 'Extend other leg', 'Switch sides smoothly', 'Keep lower back pressed down'],
          correctForm: ['Controlled twisting', 'Lower back stays down', 'Full range twist'],
          commonMistakes: ['Pulling on neck', 'Too fast', 'Lower back lifting'],
          breathing: 'Exhale as you twist, inhale as you switch',
          easierVersion: 'Keep feet on ground or reduce range',
          harderVersion: 'Slow down tempo or add longer holds',
          safetyNote: 'Never pull on your neck - hands just support head'
        },
        detailedExercises.plank,
        {
          name: 'Russian Twists',
          sets: 3,
          reps: '20 total',
          restTime: 45,
          instructions: '📋 STEPS: 1) Sit with knees bent, feet elevated. 2) Lean back slightly, core engaged. 3) Twist torso side to side. 4) Touch hands to floor on each side. 💪 MUSCLES: Obliques, Core. 🫁 BREATHING: Exhale with each twist. ✅ DO: Controlled rotation, core tight, chest up. ❌ AVOID: Using momentum, rounding back, holding breath.',
          targetMuscles: ['Obliques', 'Core', 'Hip Flexors'],
          difficulty: 'medium',
          stepByStep: ['Sit with bent knees', 'Lean back at 45°', 'Elevate feet if possible', 'Twist torso side to side', 'Touch hands to floor each side'],
          correctForm: ['Controlled rotation', 'Core stays tight', 'Back stays straight'],
          commonMistakes: ['Using momentum', 'Rounding spine', 'Feet touching floor for stability'],
          breathing: 'Exhale as you twist to each side',
          easierVersion: 'Keep feet on ground for stability',
          harderVersion: 'Hold weight or medicine ball, slower tempo',
          safetyNote: 'Keep movements controlled - don\'t use momentum'
        }
      ],
      totalDuration: 25,
      caloriesBurn: 180
    },
    {
      day: 'Day 3 - Lower Body',
      exercises: [
        detailedExercises.squats,
        {
          name: 'Glute Bridges',
          sets: 3,
          reps: '15',
          restTime: 45,
          instructions: '📋 STEPS: 1) Lie on back, knees bent, feet flat. 2) Push through heels to lift hips. 3) Squeeze glutes at top. 4) Lower hips slowly. 💪 MUSCLES: Glutes, Hamstrings, Lower Back. 🫁 BREATHING: Exhale up, inhale down. ✅ DO: Squeeze glutes hard, push through heels, straight body line. ❌ AVOID: Arching back excessively, using momentum.',
          targetMuscles: ['Glutes', 'Hamstrings', 'Lower Back'],
          difficulty: 'easy',
          stepByStep: ['Lie on back with knees bent', 'Feet flat, hip-width apart', 'Push through heels to lift hips', 'Squeeze glutes hard at top', 'Lower slowly with control'],
          correctForm: ['Squeeze glutes at top', 'Push through heels', 'Body forms straight line'],
          commonMistakes: ['Excessive back arch', 'Using momentum', 'Not squeezing glutes'],
          breathing: 'Exhale as you lift, inhale as you lower',
          easierVersion: 'Reduce range of motion',
          harderVersion: 'Single leg, add weight on hips, or hold at top',
          safetyNote: 'Don\'t overarch your back - focus on glute squeeze'
        },
        {
          name: 'Calf Raises',
          sets: 3,
          reps: '20',
          restTime: 45,
          instructions: '📋 STEPS: 1) Stand with feet hip-width. 2) Rise up onto toes. 3) Pause at top. 4) Lower slowly. 💪 MUSCLES: Calves. 🫁 BREATHING: Exhale up, inhale down. ✅ DO: Full range, controlled, pause at top. ❌ AVOID: Bouncing, partial range.',
          targetMuscles: ['Calves'],
          difficulty: 'easy',
          stepByStep: ['Stand with feet hip-width', 'Rise onto balls of feet', 'Pause at top position', 'Lower heels slowly', 'Maintain balance throughout'],
          correctForm: ['Full range of motion', 'Controlled tempo', 'Pause at top'],
          commonMistakes: ['Bouncing', 'Partial range', 'Too fast'],
          breathing: 'Exhale as you rise, inhale as you lower',
          easierVersion: 'Hold wall for balance',
          harderVersion: 'Single leg or hold dumbbells',
          safetyNote: 'Keep movements controlled to avoid ankle strain'
        },
        {
          name: 'Wall Sit',
          sets: 3,
          reps: '30 seconds',
          restTime: 60,
          instructions: '📋 STEPS: 1) Stand with back against wall. 2) Slide down until thighs parallel to floor. 3) Knees at 90° angle. 4) Hold position. 💪 MUSCLES: Quads, Glutes. 🫁 BREATHING: Steady throughout. ✅ DO: 90° knee angle, back flat on wall, breathe steadily. ❌ AVOID: Knees past toes, sliding down further.',
          targetMuscles: ['Quadriceps', 'Glutes'],
          difficulty: 'medium',
          stepByStep: ['Stand with back flat against wall', 'Slide down until thighs parallel', 'Knees at 90° angle', 'Hold steady position', 'Breathe normally'],
          correctForm: ['90° knee angle', 'Back pressed to wall', 'Steady breathing'],
          commonMistakes: ['Knees too far forward', 'Sliding too low', 'Holding breath'],
          breathing: 'Breathe steadily and normally throughout the hold',
          easierVersion: 'Hold for shorter time or don\'t go as low',
          harderVersion: 'Hold longer or lift one leg',
          safetyNote: 'Keep knees aligned with ankles, not past toes'
        },
        detailedExercises.plank
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