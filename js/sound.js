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
    masterGain.gain.value = 0.3;
    masterGain.connect(audioCtx.destination);
}

function setVolume(value) {
    if (masterGain) masterGain.gain.value = value;
}

// ─── Low-level synthesis helpers ─────────────────────────────────────────────

// Pink noise buffer using the Voss-McCartney algorithm.
// Much richer than white noise — rolls off at ~3 dB/octave like real-world
// ambient sounds, giving explosions and impacts a natural "body".
function _pinkBuf(duration) {
    const sr  = audioCtx.sampleRate;
    const len = Math.max(1, Math.ceil(sr * duration));
    const buf = audioCtx.createBuffer(1, len, sr);
    const d   = buf.getChannelData(0);
    let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
    for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886*b0 + w*0.0555179;
        b1 = 0.99332*b1 + w*0.0750759;
        b2 = 0.96900*b2 + w*0.1538520;
        b3 = 0.86650*b3 + w*0.3104856;
        b4 = 0.55000*b4 + w*0.5329522;
        b5 = -0.7616*b5 - w*0.0168980;
        d[i] = (b0+b1+b2+b3+b4+b5+b6 + w*0.5362) * 0.11;
        b6 = w * 0.115926;
    }
    return buf;
}

// Play a shaped pink-noise burst through a biquad filter.
// type: BiquadFilterNode filter type ('lowpass', 'highpass', 'bandpass')
function _noise(duration, volume, filterType, filterFreq, filterQ = 1) {
    if (!audioCtx) return;
    const now  = audioCtx.currentTime;
    const src  = audioCtx.createBufferSource();
    src.buffer = _pinkBuf(duration);

    const flt  = audioCtx.createBiquadFilter();
    flt.type   = filterType;
    flt.frequency.value = filterFreq;
    flt.Q.value = filterQ;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(flt);
    flt.connect(gain);
    gain.connect(masterGain);
    src.start(now);
}

// FM synthesis bell/tone at a scheduled absolute time `t`.
// carrier ← modulator with index `modIndex` sweeping from high to low.
function _fm(t, carrierHz, modRatio, modIndex0, modIndex1, duration, volume) {
    const mod     = audioCtx.createOscillator();
    const modGain = audioCtx.createGain();
    const carrier = audioCtx.createOscillator();
    const outGain = audioCtx.createGain();

    const modHz = carrierHz * modRatio;
    mod.frequency.value = modHz;
    modGain.gain.setValueAtTime(modHz * modIndex0, t);
    modGain.gain.exponentialRampToValueAtTime(Math.max(0.001, modHz * modIndex1), t + duration);

    carrier.frequency.value = carrierHz;
    outGain.gain.setValueAtTime(volume, t);
    outGain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(outGain);
    outGain.connect(masterGain);

    mod.start(t);     mod.stop(t + duration + 0.02);
    carrier.start(t); carrier.stop(t + duration + 0.02);
}

// Simple waveshaper distortion curve (soft-clip)
function _makeDistortionCurve(amount = 50) {
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const x = (i * 2) / n - 1;
        curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
}

// ─── Sound Effects ────────────────────────────────────────────────────────────

// Footstep — very short bandpass noise tap, slightly randomised pitch
let lastFootstepTime = 0;
function playFootstep() {
    const ms = Date.now();
    if (ms - lastFootstepTime < 140) return;
    lastFootstepTime = ms;
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const dur = 0.045;
    const src = audioCtx.createBufferSource();
    src.buffer = _pinkBuf(dur);

    const bp  = audioCtx.createBiquadFilter();
    bp.type   = 'bandpass';
    bp.frequency.value = 700 + Math.random() * 500;
    bp.Q.value = 2.5;

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.20, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(bp); bp.connect(g); g.connect(masterGain);
    src.start(now);
}

// Skill assign — two FM chime notes (like a soft bell-tap)
function playSkillAssign() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    _fm(now,        880, 2.0, 2.2, 0.08, 0.28, 0.20);
    _fm(now + 0.09, 1174, 2.0, 2.0, 0.05, 0.22, 0.14);
}

// Explosion — layered kick sweep + pink noise burst + high-frequency crack
function playExplosion() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    // 1. Sub-kick: sine pitch sweep 110 Hz → 22 Hz
    const kick     = audioCtx.createOscillator();
    const kickGain = audioCtx.createGain();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(110, now);
    kick.frequency.exponentialRampToValueAtTime(22, now + 0.45);
    kickGain.gain.setValueAtTime(0.85, now);
    kickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    kick.connect(kickGain); kickGain.connect(masterGain);
    kick.start(now); kick.stop(now + 0.55);

    // 2. Mid noise body — lowpass pink noise sweeping from 3 kHz → 300 Hz
    const nSrc  = audioCtx.createBufferSource();
    nSrc.buffer = _pinkBuf(0.65);
    const lp    = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3000, now);
    lp.frequency.exponentialRampToValueAtTime(300, now + 0.5);
    const nGain = audioCtx.createGain();
    nGain.gain.setValueAtTime(0.55, now);
    nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
    const dist = audioCtx.createWaveShaper();
    dist.curve = _makeDistortionCurve(30);
    nSrc.connect(lp); lp.connect(dist); dist.connect(nGain); nGain.connect(masterGain);
    nSrc.start(now);

    // 3. High crack — brief highpass burst
    const cSrc  = audioCtx.createBufferSource();
    cSrc.buffer = _pinkBuf(0.09);
    const hp    = audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2200;
    const cGain = audioCtx.createGain();
    cGain.gain.setValueAtTime(0.35, now + 0.01);
    cGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.10);
    cSrc.connect(hp); hp.connect(cGain); cGain.connect(masterGain);
    cSrc.start(now + 0.01);
}

// Exit cheer — ascending FM bell arpeggio (C5 E5 G5 C6)
function playExitCheer() {
    if (!audioCtx) return;
    const now   = audioCtx.currentTime;
    const chord = [523, 659, 784, 1047];
    chord.forEach((hz, i) => {
        _fm(now + i * 0.10, hz, 2.0, 2.5, 0.05, 0.32, 0.18 - i * 0.01);
    });
    // sparkle top note
    _fm(now + 0.44, 2093, 3.0, 1.2, 0.02, 0.18, 0.10);
}

// Death / splat — wet bandpass thud + descending pitch glide
function playDeath() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    // Wet splat: bandpass pink noise
    const sSrc  = audioCtx.createBufferSource();
    sSrc.buffer = _pinkBuf(0.28);
    const bp    = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 320;
    bp.Q.value = 0.7;
    const sGain = audioCtx.createGain();
    sGain.gain.setValueAtTime(0.65, now);
    sGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    sSrc.connect(bp); bp.connect(sGain); sGain.connect(masterGain);
    sSrc.start(now);

    // "Oof" pitch glide 280 Hz → 60 Hz
    const osc     = audioCtx.createOscillator();
    const oscGain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.20);
    oscGain.gain.setValueAtTime(0.30, now);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(oscGain); oscGain.connect(masterGain);
    osc.start(now); osc.stop(now + 0.23);
}

// Nuke warning — two-tone urgent siren
function playNukeWarning() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    [0, 0.22, 0.44].forEach(dt => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(880, now + dt);
        o.frequency.setValueAtTime(660, now + dt + 0.11);
        g.gain.setValueAtTime(0.12, now + dt);
        g.gain.setValueAtTime(0.12, now + dt + 0.10);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dt + 0.21);
        o.connect(g); g.connect(masterGain);
        o.start(now + dt); o.stop(now + dt + 0.22);
    });
}

// Level complete — FM fanfare, C major arp with final chord ring
function playLevelComplete() {
    if (!audioCtx) return;
    const now    = audioCtx.currentTime;
    const melody = [523, 659, 784, 1047, 1319];
    melody.forEach((hz, i) => {
        const isLast = i === melody.length - 1;
        _fm(now + i * 0.14, hz, 1.5, 2.0, 0.04, isLast ? 0.55 : 0.20, isLast ? 0.24 : 0.18);
    });
}

// Level fail — descending FM tones, minor feel
function playLevelFail() {
    if (!audioCtx) return;
    const now   = audioCtx.currentTime;
    const notes = [494, 415, 370, 294]; // B4 Ab4 F#4 D4
    notes.forEach((hz, i) => {
        _fm(now + i * 0.20, hz, 1.5, 1.8, 0.05, 0.25, 0.16);
    });
}

// Dig — short scrape: mid bandpass pink noise
function playDig() {
    if (!audioCtx) return;
    _noise(0.09, 0.28, 'bandpass', 560, 2.2);
}

// Build — woody thud: pitched sine click + brief mid noise
function playBuild() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const o   = audioCtx.createOscillator();
    const g   = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(210, now);
    o.frequency.exponentialRampToValueAtTime(110, now + 0.07);
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    o.connect(g); g.connect(masterGain);
    o.start(now); o.stop(now + 0.09);
    _noise(0.06, 0.12, 'bandpass', 1100, 1.8);
}

// Bash — impact thump (pitch sweep) + highpass crack
function playBash() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, now);
    o.frequency.exponentialRampToValueAtTime(40, now + 0.13);
    g.gain.setValueAtTime(0.42, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    o.connect(g); g.connect(masterGain);
    o.start(now); o.stop(now + 0.16);

    _noise(0.10, 0.22, 'highpass', 1100, 1.0);
}

// Click / UI — crisp FM tick
function playClick() {
    if (!audioCtx) return;
    _fm(audioCtx.currentTime, 1200, 3.0, 0.8, 0.01, 0.06, 0.10);
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