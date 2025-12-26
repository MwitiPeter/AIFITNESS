const axios = require('axios');

// ExerciseDB API configuration
const EXERCISEDB_API_URL = 'https://exercisedb.p.rapidapi.com/exercises';
const EXERCISEDB_API_KEY = process.env.RAPIDAPI_KEY;

// In-memory cache to avoid repeated API calls
const exerciseCache = new Map();

// Cache expiration time (24 hours in milliseconds)
const CACHE_EXPIRY = 24 * 60 * 60 * 1000;
// Shorter cache for null results (1 hour) to allow retry for exercises that might be added later
const NULL_CACHE_EXPIRY = 60 * 60 * 1000;

/**
 * Normalize exercise name for API query
 * - Convert to lowercase
 * - Remove plurals (simple heuristic: remove trailing 's' if word ends with 's')
 * - Trim spaces
 * - Remove special characters that might interfere
 */
const normalizeExerciseName = (exerciseName) => {
  if (!exerciseName) return '';
  
  let normalized = exerciseName
    .toLowerCase()
    .trim()
    // Remove common prefixes/suffixes
    .replace(/^(bodyweight|bw|dumbbell|db|barbell|bb)\s+/i, '')
    // Remove special characters except spaces and hyphens
    .replace(/[^\w\s-]/g, '')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    .trim();
  
  // Simple plural removal - remove trailing 's' if word ends with 's' and length > 3
  // This is a heuristic and won't catch all cases, but helps with common exercises
  const words = normalized.split(' ');
  normalized = words.map(word => {
    if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) {
      return word.slice(0, -1);
    }
    return word;
  }).join(' ');
  
  return normalized;
};

/**
 * Get exercise data from ExerciseDB API
 * @param {string} exerciseName - The exercise name to search for
 * @returns {Promise<Object|null>} Exercise data with demo media URL or null if not found
 */
const getExerciseFromDB = async (exerciseName) => {
  if (!EXERCISEDB_API_KEY) {
    console.warn('⚠️ RAPIDAPI_KEY not configured. Skipping ExerciseDB lookup.');
    return null;
  }

  const normalizedName = normalizeExerciseName(exerciseName);
  
  // Check cache first
  const cacheKey = normalizedName;
  const cached = exerciseCache.get(cacheKey);
  
  if (cached) {
    const { data, timestamp, isNullResult } = cached;
    // Check if cache is still valid (use shorter expiry for null results)
    const expiry = isNullResult ? NULL_CACHE_EXPIRY : CACHE_EXPIRY;
    if (Date.now() - timestamp < expiry) {
      console.log(`✅ Cache hit for: ${exerciseName} (normalized: ${normalizedName})`);
      return data;
    } else {
      // Cache expired, remove it
      exerciseCache.delete(cacheKey);
    }
  }

  try {
    console.log(`🔍 Searching ExerciseDB for: ${exerciseName} (normalized: ${normalizedName})`);
    
    let exercise = null;
    
    // Strategy 1: Search by exact name
    try {
      const response = await axios.get(`${EXERCISEDB_API_URL}/name/${encodeURIComponent(normalizedName)}`, {
        headers: {
          'X-RapidAPI-Key': EXERCISEDB_API_KEY,
          'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com'
        },
        timeout: 5000
      });
      
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        // Find the best match (exact name match preferred, otherwise first result)
        exercise = response.data[0];
        
        // Try to find exact name match
        const exactMatch = response.data.find(
          ex => ex.name && ex.name.toLowerCase() === normalizedName.toLowerCase()
        );
        if (exactMatch) {
          exercise = exactMatch;
        }
      }
    } catch (err) {
      console.log(`⚠️ Exact name search failed: ${err.message}`);
    }
    
    // Strategy 2: If no results, try searching by body part
    if (!exercise) {
      try {
        const bodyParts = ['chest', 'back', 'cardio', 'lower%20arms', 'lower%20legs', 'neck', 'shoulders', 'upper%20arms', 'upper%20legs', 'waist'];
        for (const bodyPart of bodyParts) {
          try {
            const bodyPartResponse = await axios.get(`${EXERCISEDB_API_URL}/bodyPart/${bodyPart}`, {
              headers: {
                'X-RapidAPI-Key': EXERCISEDB_API_KEY,
                'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com'
              },
              timeout: 3000
            });
            
            if (bodyPartResponse.data && Array.isArray(bodyPartResponse.data)) {
              // Search within results for matching name
              const match = bodyPartResponse.data.find(ex => {
                if (!ex.name) return false;
                const exNameLower = ex.name.toLowerCase().replace(/\s+/g, '');
                const normalizedLower = normalizedName.replace(/\s+/g, '');
                return exNameLower.includes(normalizedLower) || normalizedLower.includes(exNameLower);
              });
              
              if (match) {
                exercise = match;
                break;
              }
            }
          } catch (err) {
            continue;
          }
        }
      } catch (err) {
        console.log(`⚠️ Body part search also failed`);
      }
    }
    
    if (exercise) {
      
      // Extract demo media URL (prefer gifUrl, fallback to image, then try other fields)
      let demoMediaUrl = exercise.gifUrl || exercise.image || null;
      
      // If still no URL, check for other possible fields
      if (!demoMediaUrl) {
        demoMediaUrl = exercise.gif || exercise.img || exercise.mediaUrl || exercise.videoUrl || null;
      }
      
      if (!demoMediaUrl) {
        console.log(`⚠️ ExerciseDB found ${exerciseName} but no demo media available`);
        // Cache null result if no media
        exerciseCache.set(cacheKey, {
          data: null,
          timestamp: Date.now(),
          isNullResult: true
        });
        return null;
      }
      
      const result = {
        name: exercise.name || exerciseName,
        demoMediaUrl: demoMediaUrl,
        bodyPart: exercise.bodyPart || null,
        equipment: exercise.equipment || null,
        target: exercise.target || null,
        secondaryMuscles: exercise.secondaryMuscles || [],
        instructions: exercise.instructions || []
      };

      // Cache the result
      exerciseCache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
        isNullResult: false
      });

      console.log(`✅ Found ExerciseDB data for: ${exerciseName}`);
      return result;
    } else {
      // No results found
      console.log(`⚠️ No ExerciseDB results for: ${exerciseName} (normalized: ${normalizedName})`);
      
      // Cache the null result to avoid repeated failed lookups (shorter cache time - 1 hour)
      exerciseCache.set(cacheKey, {
        data: null,
        timestamp: Date.now(),
        isNullResult: true
      });
      
      return null;
    }
  } catch (error) {
    // Handle different error types
    if (error.response) {
      // API returned error response
      if (error.response.status === 404) {
        console.log(`⚠️ ExerciseDB: Exercise not found - ${exerciseName}`);
        // Cache 404s for shorter time (1 hour)
        exerciseCache.set(cacheKey, {
          data: null,
          timestamp: Date.now(),
          isNullResult: true
        });
      } else {
        console.error(`❌ ExerciseDB API error for ${exerciseName}: ${error.response.status} - ${error.response.statusText}`);
      }
    } else if (error.request) {
      // Request made but no response
      console.error(`❌ ExerciseDB API timeout/network error for ${exerciseName}`);
    } else {
      // Error setting up request
      console.error(`❌ ExerciseDB API setup error for ${exerciseName}:`, error.message);
    }
    
    // Don't cache non-404 errors - allow retry on next request
    return null;
  }
};

/**
 * Batch fetch exercise data for multiple exercises
 * @param {Array<string>} exerciseNames - Array of exercise names
 * @returns {Promise<Array<Object>>} Array of exercise data objects
 */
const batchGetExercises = async (exerciseNames) => {
  if (!exerciseNames || exerciseNames.length === 0) {
    return [];
  }

  console.log(`📦 Batch fetching ExerciseDB data for ${exerciseNames.length} exercises...`);
  
  // Process exercises in parallel with rate limiting (max 5 concurrent requests)
  const batchSize = 5;
  const results = [];
  
  for (let i = 0; i < exerciseNames.length; i += batchSize) {
    const batch = exerciseNames.slice(i, i + batchSize);
    const batchPromises = batch.map(name => getExerciseFromDB(name));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < exerciseNames.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  const found = results.filter(r => r !== null).length;
  console.log(`✅ Batch fetch complete: ${found}/${exerciseNames.length} exercises found in ExerciseDB`);
  
  return results;
};

/**
 * Enrich workout exercises with ExerciseDB demo media
 * @param {Array<Object>} exercises - Array of exercise objects from Hugging Face
 * @returns {Promise<Array<Object>>} Enriched exercises with demoMediaUrl
 */
const enrichExercisesWithDemoMedia = async (exercises) => {
  if (!exercises || exercises.length === 0) {
    return exercises;
  }

  // Extract exercise names
  const exerciseNames = exercises.map(ex => ex.name).filter(Boolean);
  
  if (exerciseNames.length === 0) {
    return exercises;
  }

  // Fetch ExerciseDB data for all exercises
  const exerciseDBData = await batchGetExercises(exerciseNames);
  
  // Create a map for quick lookup
  const dbDataMap = new Map();
  exerciseDBData.forEach((data, index) => {
    if (data) {
      // Use normalized name as key for lookup
      const normalized = normalizeExerciseName(exerciseNames[index]);
      dbDataMap.set(normalized, data);
    }
  });

  // Merge ExerciseDB data into exercises - PRESERVE ALL ORIGINAL FIELDS
  const enrichedExercises = exercises.map(exercise => {
    const normalized = normalizeExerciseName(exercise.name);
    const dbData = dbDataMap.get(normalized);
    
    if (dbData && dbData.demoMediaUrl) {
      // Preserve ALL original exercise fields, just add demoMediaUrl
      return {
        ...exercise, // This preserves stepByStep, instructions, targetMuscles, etc.
        demoMediaUrl: dbData.demoMediaUrl,
        // Optionally add other ExerciseDB fields
        exerciseDBBodyPart: dbData.bodyPart,
        exerciseDBEquipment: dbData.equipment,
        exerciseDBTarget: dbData.target
      };
    }
    
    // Return exercise as-is if no ExerciseDB data found - PRESERVE ALL FIELDS
    return { ...exercise };
  });

  return enrichedExercises;
};

module.exports = {
  getExerciseFromDB,
  batchGetExercises,
  enrichExercisesWithDemoMedia,
  normalizeExerciseName
};

