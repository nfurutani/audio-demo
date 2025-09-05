# Audio Demo - Development Log

## Project Overview
3D audio visualizer using Three.js with iOS Safari sleep compatibility.

## Server Details
- **IP**: 45.77.24.40
- **Path**: /var/www/audio-demo/
- **Process**: PM2 (audio-demo)

## Deployment Commands
```bash
scp -r public/ root@45.77.24.40:/var/www/audio-demo/
scp server.js root@45.77.24.40:/var/www/audio-demo/
ssh root@45.77.24.40
cd /var/www/audio-demo
pm2 restart audio-demo
```

## Major Issues Resolved

### iOS Safari Background Audio Playback Issue

**Problem**: 
- Audio stopped playing when iPhone went to sleep/background
- Progress bar continued running (indicating HTML5 audio was still "playing")
- Desktop browsers worked perfectly
- Issue was specific to iOS Safari WebKit limitations

**Investigation Process**:
1. Initially tried multiple failed approaches based on assumptions
2. Implemented server-side logging to debug actual iOS behavior
3. Discovered AudioContext enters "interrupted" state during sleep (iOS-specific)

**Failed Solutions** (removed during cleanup):
- Wake Lock API attempts
- Audio element attributes (controls, preload)
- Manual event listeners (visibilitychange, focus, resume)
- Complex visibility state handling

**Effective Solution**:
**Continuous AudioContext State Monitoring**
- Monitor AudioContext state every 1000ms
- Auto-resume when state changes to "interrupted" or "suspended"
- Works reliably for iPhone background/sleep scenarios

```javascript
const monitorAudioContext = () => {
  if (audioContext && isPlaying) {
    // suspended状態の場合
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    
    // interrupted状態の場合 - iOS特有の状態
    if (audioContext.state === 'interrupted') {
      audioContext.resume();
    }
  }
};

// 定期的にAudioContextの状態をチェック
setInterval(monitorAudioContext, 1000);
```

**Key Technical Insights**:
- iOS Safari has unique "interrupted" state (not just "suspended")
- AudioContext state monitoring is more reliable than event-based approaches
- HTML5 audio continues but AudioContext stops during iOS sleep
- Continuous monitoring (1s interval) provides seamless background playback

## Code Cleanup (2025-09-02)
Removed unnecessary debugging code added during investigation:

### Removed from main.js:
1. **Wake Lock API code** - `wakeLock` variable and related logic
2. **Debug logging functions** - `logToServer()` function
3. **Redundant event listeners** - visibilitychange, resume, focus handlers
4. **Manual AudioContext resume logic** - Replaced by automated monitoring
5. **handleVisibilityChange function** - Complex visibility state handling

### Removed from server.js:
1. **JSON body parser** - `express.json()` middleware
2. **iOS log endpoint** - `/log` POST route for debugging

## Current State
- **main.js**: Clean code with essential 3D visualization and iOS-compatible audio
- **server.js**: Simple static file server
- **Functionality**: Audio continues during iOS sleep via automated AudioContext monitoring

## Key Lessons
- Investigation before implementation prevents unnecessary code complexity
- iOS Safari requires specific "interrupted" state handling for background audio
- Server-side logging was crucial for identifying the actual issue vs assumptions