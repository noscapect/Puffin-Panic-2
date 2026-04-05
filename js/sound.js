// --- Sound System ---
// Procedural audio generation using Web Audio API
// No external audio files needed!

let audioCtx = null;
let masterGain = null;
let bgmPlaying = false;
let bgmOscillators = [];

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.3; // Default volume
    masterGain.connect(audioCtx.destination);
}

function setVolume(value) {
    if (masterGain) {
        masterGain.gain.value = value;
    }
}

// Play a tone with envelope
function playTone(freq, duration, type = 'sine', volume = 0.3) {
    if (!audioCtx) return;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.value = freq;
    
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(masterGain);
    
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
}

// White noise generator for explosion/dig sounds
function playNoise(duration, volume = 0.2, filterFreq = 1000) {
    if (!audioCtx) return;
    
    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    
    source.start(audioCtx.currentTime);
}

// --- Sound Effects ---

// Tiny footsteps for walking
let lastFootstepTime = 0;
function playFootstep() {
    const now = Date.now();
    if (now - lastFootstepTime < 150) return; // Limit footstep frequency
    lastFootstepTime = now;
    
    if (!audioCtx) return;
    
    // Soft tick sound
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = 200 + Math.random() * 100;
    
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    
    osc.connect(gain);
    gain.connect(masterGain);
    
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.05);
}

// Skill assignment sound
function playSkillAssign() {
    if (!audioCtx) return;
    
    // Pleasant ascending chime
    playTone(523, 0.1, 'sine', 0.2); // C5
    setTimeout(() => playTone(659, 0.1, 'sine', 0.2), 50); // E5
    setTimeout(() => playTone(784, 0.15, 'sine', 0.15), 100); // G5
}

// Explosion sound
function playExplosion() {
    if (!audioCtx) return;
    
    // Low boom with noise
    playTone(80, 0.5, 'sawtooth', 0.4);
    playTone(60, 0.4, 'square', 0.2);
    playNoise(0.4, 0.3, 800);
    
    // High-frequency crack
    setTimeout(() => playNoise(0.15, 0.15, 3000), 50);
}

// Puffin exiting (cheer sound)
function playExitCheer() {
    if (!audioCtx) return;
    
    // Happy ascending arpeggio
    playTone(440, 0.1, 'sine', 0.2); // A4
    setTimeout(() => playTone(554, 0.1, 'sine', 0.2), 80); // C#5
    setTimeout(() => playTone(659, 0.1, 'sine', 0.2), 160); // E5
    setTimeout(() => playTone(880, 0.2, 'sine', 0.25), 240); // A5
    
    // Sparkle effect
    setTimeout(() => playTone(1200, 0.1, 'sine', 0.1), 300);
}

// Death/splat sound
function playDeath() {
    if (!audioCtx) return;
    
    // Unpleasant descending sound
    playTone(300, 0.1, 'sawtooth', 0.2);
    setTimeout(() => playTone(200, 0.1, 'sawtooth', 0.15), 50);
    setTimeout(() => playTone(100, 0.2, 'sawtooth', 0.1), 100);
    
    // Splat noise
    playNoise(0.15, 0.15, 500);
}

// Nuke warning sound
function playNukeWarning() {
    if (!audioCtx) return;
    
    // Alarm sound
    playTone(800, 0.15, 'square', 0.15);
    setTimeout(() => playTone(600, 0.15, 'square', 0.15), 200);
}

// Level complete fanfare
function playLevelComplete() {
    if (!audioCtx) return;
    
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((note, i) => {
        setTimeout(() => playTone(note, 0.2, 'sine', 0.2), i * 150);
    });
    setTimeout(() => playTone(1047, 0.4, 'sine', 0.3), 600);
}

// Level fail sound
function playLevelFail() {
    if (!audioCtx) return;
    
    const notes = [400, 350, 300, 200];
    notes.forEach((note, i) => {
        setTimeout(() => playTone(note, 0.2, 'sawtooth', 0.15), i * 200);
    });
}

// Digging sound
function playDig() {
    if (!audioCtx) return;
    playNoise(0.08, 0.1, 600);
}

// Building sound
function playBuild() {
    if (!audioCtx) return;
    playTone(300, 0.05, 'square', 0.1);
    playNoise(0.05, 0.08, 1200);
}

// Bashing sound
function playBash() {
    if (!audioCtx) return;
    playTone(150, 0.1, 'square', 0.15);
    playNoise(0.1, 0.12, 800);
}

// Click/UI sound
function playClick() {
    if (!audioCtx) return;
    playTone(600, 0.05, 'sine', 0.1);
}

// --- Background Music ---

function startBGM() {
    if (!audioCtx || bgmPlaying) return;
    bgmPlaying = true;
    
    // Simple ambient loop using oscillators
    const bpm = 60;
    const beatDuration = 60 / bpm;
    
    // Bass line pattern
    const bassNotes = [130.81, 146.83, 164.81, 146.83]; // C3, D3, E3, D3
    const bassDuration = beatDuration * 2;
    
    // Melody pattern
    const melodyNotes = [
        [392, 0.5], [440, 0.5], [494, 0.5], [440, 0.5], // G4, A4, B4, A4
        [392, 0.5], [349, 0.5], [330, 0.5], [349, 0.5], // G4, F4, E4, F4
    ];
    
    function playBGMLoop() {
        if (!bgmPlaying || !audioCtx) return;
        
        const now = audioCtx.currentTime;
        
        // Play bass notes
        bassNotes.forEach((note, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = 'sine';
            osc.frequency.value = note;
            
            const startTime = now + i * bassDuration;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.08, startTime + 0.05);
            gain.gain.linearRampToValueAtTime(0, startTime + bassDuration - 0.05);
            
            osc.connect(gain);
            gain.connect(masterGain);
            
            osc.start(startTime);
            osc.stop(startTime + bassDuration);
            bgmOscillators.push(osc);
        });
        
        // Play melody notes
        let melodyTime = 0;
        melodyNotes.forEach(([note, dur]) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.value = note;
            
            const startTime = now + melodyTime * beatDuration;
            const noteLen = dur * beatDuration;
            
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.04, startTime + 0.02);
            gain.gain.linearRampToValueAtTime(0, startTime + noteLen);
            
            osc.connect(gain);
            gain.connect(masterGain);
            
            osc.start(startTime);
            osc.stop(startTime + noteLen);
            bgmOscillators.push(osc);
            
            melodyTime += dur;
        });
        
        // Schedule next loop
        const loopDuration = bassNotes.length * bassDuration * 1000;
        setTimeout(playBGMLoop, loopDuration - 100);
    }
    
    playBGMLoop();
}

function stopBGM() {
    bgmPlaying = false;
    bgmOscillators.forEach(osc => {
        try { osc.stop(); } catch(e) {}
    });
    bgmOscillators = [];
}

function toggleBGM() {
    if (bgmPlaying) {
        stopBGM();
    } else {
        startBGM();
    }
    return bgmPlaying;
}

// --- Sound Manager ---

const Sound = {
    init: initAudio,
    setVolume: setVolume,
    
    // SFX
    footstep: playFootstep,
    skillAssign: playSkillAssign,
    explosion: playExplosion,
    exitCheer: playExitCheer,
    death: playDeath,
    nukeWarning: playNukeWarning,
    levelComplete: playLevelComplete,
    levelFail: playLevelFail,
    dig: playDig,
    build: playBuild,
    bash: playBash,
    click: playClick,
    
    // BGM
    startBGM: startBGM,
    stopBGM: stopBGM,
    toggleBGM: toggleBGM,
    isPlaying: () => bgmPlaying
};

// Export for use in other files
window.Sound = Sound;