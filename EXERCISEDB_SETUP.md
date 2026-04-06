# ExerciseDB API Integration Setup

This document explains how to set up the ExerciseDB API integration for fetching exercise demo media (GIFs/images).

## Prerequisites

1. A RapidAPI account (free tier available)
2. Subscribe to the ExerciseDB API on RapidAPI

## Setup Steps

### 1. Get RapidAPI Key

1. Go to [RapidAPI](https://rapidapi.com/)
2. Sign up or log in
3. Navigate to [ExerciseDB API](https://rapidapi.com/justin-WFnsXH_t6/api/exercisedb)
4. Click "Subscribe to Test" (free tier available)
5. Copy your API key from the "X-RapidAPI-Key" section

### 2. Add Environment Variable

Add the following to your `.env` file in the backend directory:

```env
RAPIDAPI_KEY=your_rapidapi_key_here
```

### 3. How It Works

- After Hugging Face generates workout exercises, the system automatically queries ExerciseDB for each exercise
- Exercise names are normalized (lowercased, plurals removed, spaces trimmed) before querying
- Demo media URLs (GIFs or images) are fetched and merged into the exercise data
- Results are cached in memory for 24 hours to avoid repeated API calls
- If an exercise is not found in ExerciseDB, the workout continues without the demo media

### 4. Error Handling

- If `RAPIDAPI_KEY` is not set, the system will skip ExerciseDB lookups and continue normally
- If an exercise is not found in ExerciseDB, it will be marked as unavailable but the workout will still work
- API errors are logged but don't break the workout generation process

### 5. Caching

- ExerciseDB results are cached in memory for 24 hours
- This prevents repeated API calls for the same exercises
- Cache is automatically cleared after expiration

## Testing

To test the integration:

1. Ensure `RAPIDAPI_KEY` is set in your `.env` file
2. Generate a new workout plan through the app
3. Check the console logs for ExerciseDB lookup messages
4. View exercises in the workout tracker - demo images should appear if available

## API Limits

Be aware of RapidAPI rate limits:
- Free tier: 500 requests/month
- Paid tiers: Higher limits available

The caching system helps minimize API calls by storing results for 24 hours.











