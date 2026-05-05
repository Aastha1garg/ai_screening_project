# Real-Time Resume Scoring System Implementation Guide

## Overview
Your AI resume screening project has been upgraded with a real-time scoring system that processes resumes incrementally and streams results to the frontend via WebSockets, providing live progress updates and animated visualizations.

## Architecture

### Backend Components

#### 1. **WebSocket Endpoint** (`backend/main.py`)
- **Route**: `/ws/upload`
- **Purpose**: Accepts upload data via WebSocket and streams scoring progress
- **Message Flow**:
  - Client sends: `{ resumes: [...], jds: [...], template: "..." }`
  - Server streams: `ScoringProgress` events (started, processing, completed, error, all_completed)

#### 2. **Real-Time Scoring Module** (`backend/realtime_scoring.py`)
New module with three key components:

##### `ScoringProgress` Model
Pydantic model for streaming progress updates with fields:
- `event`: "started", "processing", "completed", "error", "all_completed"
- `total_pairs`: Total resume-JD combinations to process
- `current_pair`: Current pair being processed
- `current_resume`: Name of current resume
- `current_jd`: Name of current JD
- `result`: Complete scoring result (for "completed" events)
- `progress_percent`: 0-100 progress indicator
- `error`: Error message (if applicable)

##### `WeightedScoringStrategy` Class
Optimized scoring formula using weights:
- **Skill Matching**: 35% (most critical)
- **Semantic Similarity**: 25% (BERT-based overall match)
- **Experience Level**: 20% (years and relevance)
- **Education Match**: 15% (degree level alignment)
- **Format Quality**: 5% (resume structure)

Method: `calculate_weighted_score(skill, similarity, experience, education, format) -> float`

##### `stream_resume_screening()` Async Function
Processes resumes incrementally:
- Takes lists of (name, text) tuples for resumes and JDs
- Calls callback function for each progress update
- Returns list of all results
- Handles errors gracefully without stopping processing

### Frontend Components

#### 1. **WebSocket Hook** (`frontend/src/hooks/useRealtimeScoring.js`)
Custom React hook for WebSocket communication:

```javascript
const { connect, disconnect, progress, results, isConnected, error } = useRealtimeScoring(onResultReceived);

// Connect and start streaming
await connect(resumeTexts, jdTexts, templateText);

// Returns:
// - connect(resumes, jds, template): Promise that resolves with all results
// - disconnect(): Close WebSocket connection
// - progress: Current ScoringProgress object
// - results: Array of results received so far
// - isConnected: Boolean connection status
// - error: Error message if any
```

Features:
- Automatic URL determination (ws:// or wss://)
- Robust error handling
- Connection management with cleanup

#### 2. **Progress Indicator Component** (`frontend/src/components/ProgressIndicator.js`)
Visual feedback during real-time scoring:
- Animated progress bar with percentage
- Current resume/JD being processed
- Pair counter (e.g., "3 / 12")
- Animated pulsing dots
- Error display
- Fixed position (bottom-right)

#### 3. **Real-Time Toggle** (`frontend/src/components/UploadForm.js`)
New form section with:
- Checkbox toggle: "🚀 Real-time Scoring" vs "📋 Traditional Upload"
- Hint text explaining the difference
- Disabled during upload process

#### 4. **Updated App Component** (`frontend/src/App.js`)
Integration points:
- State management for `useRealtimeMode`, `realtimeProgress`, `realtimeResults`
- Hook: `useRealtimeScoring()` for WebSocket management
- Updated `performUpload()` function:
  - If real-time mode enabled: reads files, connects WebSocket, streams results
  - If traditional mode: uses existing FormData upload
- `ProgressIndicator` component rendered when uploading
- Progress tracking via `useEffect`

## Usage Flow

### Real-Time Mode (New)
1. User toggles "Real-time Scoring" on UploadForm
2. User selects resumes, JDs, optional template
3. User clicks "Upload & Analyze"
4. Frontend reads files as text
5. WebSocket connection established at `/ws/upload`
6. Server processes pairs incrementally, sending progress
7. Progress indicator shows:
   - Overall progress bar
   - Current resume and JD being processed
   - Pair counter
   - Real-time animated updates
8. Dashboard updates dynamically as results arrive
9. Final results grouped by JD

### Traditional Mode (Existing)
- Uses standard REST API POST to `/upload`
- All processing happens server-side
- Results returned in batch

## Key Features

### 1. **Incremental Processing**
- Resume-JD pairs processed one at a time
- Results available immediately after each pair
- No waiting for all pairs to complete

### 2. **Real-Time Feedback**
- Progress bar shows overall completion
- Current item display
- Pair counter
- Smooth animations
- Error handling per pair (continues processing)

### 3. **Weighted Scoring**
- Skill matching prioritized (35%)
- Semantic similarity (BERT) (25%)
- Experience consideration (20%)
- Education alignment (15%)
- Format quality (5%)
- Total: 100% with meaningful weights

### 4. **Dynamic UI Updates**
- Progress indicator component
- Real-time progress tracking
- Animated progress bar
- Current processing display

## Configuration

### Backend Changes
1. Added `websockets` to `backend/requirements.txt`
2. New imports in `main.py`:
   - `WebSocket`, `WebSocketDisconnect` from FastAPI
   - `stream_resume_screening`, `serialize_scoring_progress`, `ScoringProgress` from realtime_scoring

### Frontend Changes
1. New hook: `src/hooks/useRealtimeScoring.js`
2. New component: `src/components/ProgressIndicator.js`
3. New stylesheet: `src/styles/ProgressIndicator.css`
4. Updated stylesheet: Added `.realtime-toggle` classes to `src/styles.css`
5. Updated App.js with real-time state and logic
6. Updated UploadForm.js to support mode toggle

## Testing the Implementation

### Setup
```bash
# Install backend dependencies
cd backend
pip install -r requirements.txt  # includes websockets

# Frontend already has React and necessary dependencies
cd ../frontend
npm install  # if needed
```

### Start Servers
```bash
# Terminal 1: Backend
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend
cd frontend
npm start
```

### Test Steps
1. Navigate to Upload page
2. Toggle "Real-time Scoring" ON
3. Upload:
   - 2-3 resumes (PDF/DOCX/TXT)
   - 2 job descriptions
   - Optional: template resume
4. Observe:
   - Progress indicator appears (bottom-right)
   - Progress bar animates
   - Real-time pair processing display
   - Each result appears as completed
5. Verify:
   - Dashboard updates with results
   - Results grouped by JD
   - Graphs render correctly
   - No page reload needed

### Fallback to Traditional Mode
- Toggle "Real-time Scoring" OFF
- Uses existing REST API
- All results returned at once

## Performance Characteristics

### Real-Time Mode
- **First Result**: After ~2-5 seconds (first pair completion)
- **Incremental**: One pair per ~3-10 seconds (depending on file size)
- **Network**: WebSocket connection (persistent, lower overhead)
- **Memory**: Streaming results (lower peak memory)

### Traditional Mode
- **All Results**: After all pairs complete (~3-10s per pair * count)
- **Batch**: All at once
- **Network**: HTTP/REST (stateless)
- **Memory**: All results in memory then returned

## Error Handling

### Backend
- WebSocket errors: Sends "error" event with message
- Scoring errors: Logs and continues with next pair
- Invalid input: Closes with error code 1008

### Frontend
- Connection errors: Displays error message
- JSON parsing errors: Logs to console
- Network disconnect: Cleans up WebSocket ref

## Future Enhancements

Potential improvements:
1. **Database persistence** during streaming
2. **Celery integration** for distributed processing
3. **Multi-threaded scoring** on backend
4. **Caching** of model embeddings
5. **Progress persistence** (resume interrupted uploads)
6. **Compression** of WebSocket messages for large files
7. **Custom weighted formula UI** (let users adjust weights)
8. **Batch scoring** history and comparisons

## Troubleshooting

### WebSocket Connection Fails
- Check backend is running on port 8000
- Verify CORS settings in FastAPI
- Check browser console for detailed error
- Ensure firewall allows WebSocket connections

### Progress Not Showing
- Verify ProgressIndicator component is rendered
- Check `useRealtimeMode` is true
- Inspect browser DevTools Network tab (WS filter)
- Check backend logs for errors

### Results Not Appearing
- Check if `all_completed` event received
- Verify history/results endpoints working
- Check for JavaScript errors in console

### Slow Processing
- Check CPU usage during processing
- Consider model optimization
- Profile scoring.py with cProfile

## Code Examples

### Using Real-Time Scoring in Custom App

```javascript
// Import the hook
import { useRealtimeScoring } from './hooks/useRealtimeScoring';

function MyComponent() {
  const { connect, progress, results } = useRealtimeScoring((result) => {
    console.log('New result:', result);
  });

  const handleUpload = async () => {
    const resumes = [
      { name: 'resume1.pdf', text: 'John...' },
      { name: 'resume2.pdf', text: 'Jane...' }
    ];
    const jds = [
      { name: 'jd1.pdf', text: 'Senior Engineer...' }
    ];
    
    const { results, total } = await connect(resumes, jds, '');
    console.log(`Processed ${total} pairs`);
  };

  return (
    <>
      <button onClick={handleUpload}>Start Real-Time Scoring</button>
      {progress && <p>Progress: {progress.progress_percent}%</p>}
      <p>Results received: {results.length}</p>
    </>
  );
}
```

### Extending Weighted Formula

```python
# In realtime_scoring.py
class CustomScoringStrategy(WeightedScoringStrategy):
    WEIGHTS = {
        "skill_match": 0.40,  # Increased importance
        "similarity": 0.20,
        "experience": 0.25,   # More weight to experience
        "education": 0.10,
        "format": 0.05,
    }
```

## Support & Questions

If you encounter issues or want to extend this system:
1. Check backend logs for scoring errors
2. Use browser DevTools to inspect WebSocket traffic
3. Review error messages in Progress Indicator
4. Check console for JavaScript errors
5. Verify all dependencies installed correctly

---

**Last Updated**: May 4, 2026
**Version**: 1.0 - Initial Real-Time Implementation
