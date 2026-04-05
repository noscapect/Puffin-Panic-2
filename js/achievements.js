// --- Achievement System ---

const ACHIEVEMENTS = [
    { id: 'perfectionist', name: 'Perfectionist', desc: 'Save all puffins in a level', icon: '⭐', check: (stats) => stats.saved >= stats.total && stats.total > 0 },
    { id: 'speedrunner', name: 'Speed Runner', desc: 'Complete a level in under 2 minutes', icon: '⚡', check: (stats) => stats.timeTaken < 120 * FPS },
    { id: 'minimalist', name: 'Minimalist', desc: 'Complete a level using 3 or fewer skills', icon: '🎯', check: (stats) => stats.skillsUsed <= 3 },
    { id: 'demolition', name: 'Demolition Expert', desc: 'Use 5 bombers in one level', icon: '💣', check: (stats) => stats.bombersUsed >= 5 },
    { id: 'builder100', name: 'Master Builder', desc: 'Build 100 total stairs', icon: '🏗️', check: (stats) => stats.totalBuilt >= 100 },
    { id: 'first_blood', name: 'First Rescue', desc: 'Save your first puffin', icon: '🐧', check: (stats) => stats.saved >= 1 },
    { id: 'survivor', name: 'Survivor', desc: 'Complete a level with no deaths', icon: '💚', check: (stats) => stats.dead === 0 && stats.saved >= stats.required },
    { id: 'nuke_survivor', name: 'Close Call', desc: 'Survive a nuke with at least 5 puffins', icon: '☢️', check: (stats) => stats.nukeSurvived },
    { id: 'climber10', name: 'Mountain Goat', desc: 'Use 10 climbers in one level', icon: '🧗', check: (stats) => stats.climbersUsed >= 10 },
    { id: 'floater_save', name: 'Mary Poppins', desc: 'Save a puffin with a floater from a fatal fall', icon: '☂️', check: (stats) => stats.floaterSaves >= 1 },
];

let unlockedAchievements = [];
let achievementQueue = [];
let currentAchievement = null;
let achievementDisplayTime = 0;

function loadAchievements() {
    try {
        const saved = localStorage.getItem('puffin_achievements');
        if (saved) {
            unlockedAchievements = JSON.parse(saved);
        }
    } catch (e) {
        unlockedAchievements = [];
    }
}

function saveAchievements() {
    try {
        localStorage.setItem('puffin_achievements', JSON.stringify(unlockedAchievements));
    } catch (e) {
        // localStorage not available
    }
}

function isAchievementUnlocked(id) {
    return unlockedAchievements.includes(id);
}

function unlockAchievement(id) {
    if (!isAchievementUnlocked(id)) {
        unlockedAchievements.push(id);
        saveAchievements();
        achievementQueue.push(id);
    }
}

function checkAchievements(stats) {
    ACHIEVEMENTS.forEach(achievement => {
        if (!isAchievementUnlocked(achievement.id) && achievement.check(stats)) {
            unlockAchievement(achievement.id);
        }
    });
}

function updateAchievementDisplay() {
    if (!currentAchievement && achievementQueue.length > 0) {
        currentAchievement = achievementQueue.shift();
        achievementDisplayTime = FPS * 3; // Display for 3 seconds
    }
    
    if (currentAchievement && achievementDisplayTime > 0) {
        achievementDisplayTime--;
        if (achievementDisplayTime <= 0) {
            currentAchievement = null;
        }
    }
}

function drawAchievement(ctx) {
    if (!currentAchievement) return;
    
    const achievement = ACHIEVEMENTS.find(a => a.id === currentAchievement);
    if (!achievement) return;
    
    const alpha = achievementDisplayTime > FPS * 2.5 ? 
        (3 - (achievementDisplayTime - FPS * 2.5) / FPS * 3) : 
        achievementDisplayTime > FPS * 0.5 ? 1 : achievementDisplayTime / (FPS * 0.5);
    
    const y = 50;
    const height = 40;
    const width = 250;
    const x = (GAME_WIDTH * SCALE / 2) - (width / 2);
    
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    
    // Rounded rect
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 5);
    ctx.fill();
    ctx.stroke();
    
    // Icon
    ctx.font = '20px serif';
    ctx.textAlign = 'left';
    ctx.fillText(achievement.icon, x + 10, y + 28);
    
    // Text
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('Achievement Unlocked!', x + 40, y + 16);
    
    ctx.fillStyle = '#fff';
    ctx.font = '11px monospace';
    ctx.fillText(achievement.name, x + 40, y + 32);
    
    ctx.restore();
}

// Stats tracking
let gameStats = {
    saved: 0,
    dead: 0,
    total: 0,
    required: 0,
    timeTaken: 0,
    skillsUsed: 0,
    bombersUsed: 0,
    climbersUsed: 0,
    totalBuilt: 0,
    nukeSurvived: false,
    floaterSaves: 0
};

function resetGameStats() {
    gameStats = {
        saved: 0,
        dead: 0,
        total: 0,
        required: 0,
        timeTaken: 0,
        skillsUsed: 0,
        bombersUsed: 0,
        climbersUsed: 0,
        totalBuilt: 0,
        nukeSurvived: false,
        floaterSaves: 0
    };
}

function trackSkillUse(skillId) {
    gameStats.skillsUsed++;
    if (skillId === 'bomber') gameStats.bombersUsed++;
    if (skillId === 'climber') gameStats.climbersUsed++;
}

function trackBuild() {
    gameStats.totalBuilt++;
}

// Achievement button for UI
function showAchievementsPanel() {
    let html = '<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:100;display:flex;flex-direction:column;align-items:center;justify-content:center;">';
    html += '<h2 style="color:#ffd700;margin-bottom:20px;">🏆 Achievements</h2>';
    html += '<div style="display:grid;grid-template-columns:repeat(2,250px);gap:10px;max-height:400px;overflow-y:auto;">';
    
    ACHIEVEMENTS.forEach(a => {
        const unlocked = isAchievementUnlocked(a.id);
        html += `<div style="background:${unlocked ? 'rgba(0,100,0,0.3)' : 'rgba(50,50,50,0.3)'};border:1px solid ${unlocked ? '#ffd700' : '#333'};padding:10px;border-radius:5px;">`;
        html += `<div style="font-size:24px;">${a.icon}</div>`;
        html += `<div style="color:${unlocked ? '#ffd700' : '#666'};font-weight:bold;">${a.name}</div>`;
        html += `<div style="color:${unlocked ? '#aaa' : '#444'};font-size:11px;">${a.desc}</div>`;
        html += '</div>';
    });
    
    html += '</div>';
    html += '<button onclick="this.parentElement.remove()" style="margin-top:20px;padding:10px 30px;font-family:inherit;font-size:16px;background:#4CAF50;color:white;border:none;cursor:pointer;">Close</button>';
    html += '</div>';
    
    document.body.insertAdjacentHTML('beforeend', html);
}

// Export
window.Achievements = {
    load: loadAchievements,
    check: checkAchievements,
    unlock: unlockAchievement,
    update: updateAchievementDisplay,
    draw: drawAchievement,
    showPanel: showAchievementsPanel,
    isUnlocked: isAchievementUnlocked,
    stats: gameStats,
    resetStats: resetGameStats,
    trackSkill: trackSkillUse,
    trackBuild: trackBuild
};

// Load achievements on startup
loadAchievements();