// DiabeFit Pro - Complete Diabetes Sport Management
// ==================================================

// ==================== DATA STRUCTURES ====================

const trainingSchedule = {
    0: { type: 'rest', title: 'Rustdag', description: 'Geen training. Herstel is belangrijk!', duration: 0, icon: '😴', intensity: 'none' },
    1: { type: 'cycling', title: 'Zone 2 Herstelrit', description: 'Rustige duurrit in Zone 2 op Zwift. Focus op ontspannen tempo.', duration: 45, icon: '🚴', intensity: 'low', zone: 'Zone 2 (60-70% HR)', route: 'Tempus Fugit of Tick Tock' },
    2: { type: 'strength', title: 'Krachttraining', description: 'Full-body circuit. 3 rondes met 60 sec rust.', duration: 30, icon: '💪', intensity: 'medium', exercises: [
        { name: 'Squats', reps: '15x' },
        { name: 'Push-ups', reps: '10-15x' },
        { name: 'Lunges', reps: '10x per been' },
        { name: 'Plank', reps: '30-45 sec' },
        { name: 'Glute bridges', reps: '15x' },
        { name: 'Superman', reps: '12x' }
    ]},
    3: { type: 'cycling', title: 'Interval Training', description: '4x4 min op 85-90% max HR, 3 min herstel. Hoog intensief!', duration: 50, icon: '🚴', intensity: 'high', zone: 'Zone 4-5 (85-90% HR)', route: 'Volcano Flat of Crit City' },
    4: { type: 'strength', title: 'Krachttraining', description: 'Full-body circuit. 3 rondes met 60 sec rust.', duration: 30, icon: '💪', intensity: 'medium', exercises: [
        { name: 'Squats', reps: '15x' },
        { name: 'Push-ups', reps: '10-15x' },
        { name: 'Lunges', reps: '10x per been' },
        { name: 'Plank', reps: '30-45 sec' },
        { name: 'Glute bridges', reps: '15x' },
        { name: 'Superman', reps: '12x' }
    ]},
    5: { type: 'rest', title: 'Rust of Mobiliteit', description: 'Optioneel: 15 min stretching of yoga.', duration: 15, icon: '🧘', intensity: 'none' },
    6: { type: 'cycling', title: 'Lange Duurrit', description: 'Langere rit op gemiddeld tempo. Groepsrit of route met klimwerk.', duration: 75, icon: '🚴', intensity: 'medium', zone: 'Zone 2-3 (65-80% HR)', route: 'Pretzel of Mountain Route' }
};

const dayNames = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
const dayNamesFull = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];

// ==================== APP STATE ====================

let state = {
    currentGlucose: null,
    glucoseTime: null,
    glucoseTrend: 'stable',
    
    settings: {
        targetGlucose: 7.5,
        insulinDuration: 4,
        correctionFactor: 2.5,
        carbRatio: 10,
        kidsBedtime: '19:30',
        workoutTime: '20:00',
        notifications: { reminders: true, postWorkout: true, nightCheck: false }
    },
    
    insulinLogs: [],
    carbLogs: [],
    mealLogs: [],
    glucoseLogs: [],
    workoutLogs: [],
    wellbeingLogs: [],
    
    achievements: {
        firstWorkout: false,
        fiveWorkouts: false,
        tenWorkouts: false,
        noHypoStreak: 0,
        consistentWeek: false
    },
    
    selectedDay: new Date().getDay(),
    activeWorkout: null,
    dexcomConnected: false
};

// ==================== INITIALIZATION ====================

function init() {
    loadState();
    renderAll();
    setupEventListeners();
    startIOBTimer();
}

function loadState() {
    const saved = localStorage.getItem('diabefit-pro-state');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state = { ...state, ...parsed, settings: { ...state.settings, ...parsed.settings } };
        } catch (e) { console.error('Load error:', e); }
    }
}

function saveState() {
    localStorage.setItem('diabefit-pro-state', JSON.stringify(state));
}

// ==================== IOB CALCULATOR ====================

function calculateIOB() {
    const now = new Date();
    const durationMs = state.settings.insulinDuration * 60 * 60 * 1000;
    let totalIOB = 0;
    
    state.insulinLogs.forEach(log => {
        if (log.type !== 'bolus') return;
        const elapsed = now - new Date(log.time);
        if (elapsed < durationMs && elapsed > 0) {
            totalIOB += log.amount * (1 - elapsed / durationMs);
        }
    });
    
    state.mealLogs.forEach(log => {
        const elapsed = now - new Date(log.time);
        if (elapsed < durationMs && elapsed > 0) {
            totalIOB += log.insulin * (1 - elapsed / durationMs);
        }
    });
    
    return Math.max(0, totalIOB);
}

function calculateCOB() {
    const now = new Date();
    const absorptionTimes = { fast: 30*60*1000, medium: 90*60*1000, slow: 180*60*1000 };
    let totalCOB = 0;
    
    state.carbLogs.forEach(log => {
        const elapsed = now - new Date(log.time);
        const absTime = absorptionTimes[log.type] || absorptionTimes.medium;
        if (elapsed < absTime && elapsed > 0) {
            totalCOB += log.amount * (1 - elapsed / absTime);
        }
    });
    
    state.mealLogs.forEach(log => {
        const elapsed = now - new Date(log.time);
        if (elapsed < absorptionTimes.slow && elapsed > 0) {
            totalCOB += log.carbs * (1 - elapsed / absorptionTimes.slow);
        }
    });
    
    return Math.max(0, totalCOB);
}

function getTimeSinceLastBolus() {
    const now = new Date();
    let lastBolus = null;
    
    [...state.insulinLogs.filter(l => l.type === 'bolus'), ...state.mealLogs].forEach(log => {
        const t = new Date(log.time);
        if (!lastBolus || t > lastBolus) lastBolus = t;
    });
    
    if (!lastBolus) return null;
    const elapsed = now - lastBolus;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    return hours > 0 ? `${hours}u ${minutes}m` : `${minutes}m`;
}

function startIOBTimer() {
    updateIOBDisplay();
    setInterval(updateIOBDisplay, 60000);
}

function updateIOBDisplay() {
    document.getElementById('currentIOB').textContent = calculateIOB().toFixed(1);
    document.getElementById('currentCOB').textContent = Math.round(calculateCOB());
    document.getElementById('timeSinceInsulin').textContent = getTimeSinceLastBolus() || '--';
    updateReadiness();
}

// ==================== TRAINING READINESS ====================

function calculateReadiness() {
    let score = 100;
    let advice = '';
    const glucose = state.currentGlucose;
    const target = state.settings.targetGlucose;
    const iob = calculateIOB();
    
    if (glucose === null) {
        score -= 30;
        advice = 'Meet eerst je bloedsuiker voordat je gaat trainen.';
    } else if (glucose < 4) {
        score = 0;
        advice = `Je bloedsuiker is ${glucose} - NIET SPORTEN. Neem eerst 15-20g snelle koolhydraten.`;
    } else if (glucose < 5) {
        score -= 50;
        advice = `Je bloedsuiker is ${glucose}. Neem 15-20g koolhydraten en wacht tot je boven ${target} zit.`;
    } else if (glucose < 6.5) {
        score -= 25;
        advice = `Je bloedsuiker is ${glucose}. Neem 10-15g koolhydraten om dichter bij ${target} te komen.`;
    } else if (glucose > 14) {
        score -= 40;
        advice = `Je bloedsuiker is ${glucose}. Meet eerst ketonen. Bij ketonen > 0.6: niet sporten.`;
    } else if (glucose > 10) {
        score -= 15;
    }
    
    if (iob > 1.5) {
        score -= 30;
        if (!advice) advice = `Je hebt nog ${iob.toFixed(1)} EH actieve insuline. Wacht 30-60 min of neem 15g koolhydraten.`;
    } else if (iob > 0.5) {
        score -= 15;
    }
    
    if (glucose >= 6.5 && glucose <= 8.5 && iob < 0.5) score = Math.min(100, score + 10);
    
    let status = score >= 80 ? 'success' : score >= 50 ? 'warning' : 'danger';
    let title = score >= 80 ? 'Klaar om te trainen! 💪' : score >= 50 ? 'Bijna klaar' : 'Nog niet trainen';
    
    if (!advice && score >= 80) advice = `Je bloedsuiker is ${glucose} - perfect rond je streefwaarde van ${target}. Je kunt veilig sporten!`;
    
    return { score: Math.max(0, score), status, title, advice };
}

function updateReadiness() {
    const r = calculateReadiness();
    document.getElementById('readinessScore').textContent = r.score;
    document.getElementById('readinessTitle').textContent = r.title;
    document.getElementById('mainAdviceText').textContent = r.advice;
    document.querySelector('.readiness-circle').style.setProperty('--score', r.score);
    document.getElementById('mainAdvice').className = `advice-box ${r.status}`;
}

// ==================== GLUCOSE MANAGEMENT ====================

function updateGlucose() {
    const input = document.getElementById('glucoseInput');
    const value = parseFloat(input.value);
    
    if (value >= 1 && value <= 30) {
        if (state.currentGlucose !== null) {
            const diff = value - state.currentGlucose;
            state.glucoseTrend = diff > 0.5 ? 'rising' : diff < -0.5 ? 'falling' : 'stable';
        }
        
        state.currentGlucose = value;
        state.glucoseTime = new Date().toISOString();
        state.glucoseLogs.push({ time: state.glucoseTime, value, context: 'other' });
        
        saveState();
        renderGlucoseDisplay();
        updateReadiness();
        input.value = '';
        showToast('Glucose bijgewerkt! ✓');
    } else {
        showToast('Voer een waarde in tussen 1-30');
    }
}

function renderGlucoseDisplay() {
    const valueEl = document.getElementById('currentGlucose');
    const trendEl = document.getElementById('glucoseTrend');
    
    if (state.currentGlucose !== null) {
        valueEl.textContent = state.currentGlucose.toFixed(1);
        valueEl.className = 'glucose-value ' + (state.currentGlucose < 5 ? 'low' : state.currentGlucose > 10 ? 'high' : 'ok');
        
        trendEl.className = 'glucose-trend ' + state.glucoseTrend;
        trendEl.innerHTML = state.glucoseTrend === 'rising' ? '<span>↗</span> Stijgend' : 
                           state.glucoseTrend === 'falling' ? '<span>↘</span> Dalend' : '<span>→</span> Stabiel';
    }
}

// ==================== LOGGING FUNCTIONS ====================

function logInsulin() {
    const amount = parseFloat(document.getElementById('insulinAmount').value);
    const type = document.getElementById('insulinType').value;
    
    if (amount > 0) {
        state.insulinLogs.push({ time: new Date().toISOString(), amount, type });
        saveState();
        updateIOBDisplay();
        closeModal('insulinModal');
        showToast(`${amount} EH ${type} gelogd ✓`);
        document.getElementById('insulinAmount').value = '';
        renderLogs();
    }
}

function logCarbs() {
    const amount = parseInt(document.getElementById('carbsAmount').value);
    const type = document.getElementById('carbsType').value;
    
    if (amount > 0) {
        state.carbLogs.push({ time: new Date().toISOString(), amount, type });
        saveState();
        updateIOBDisplay();
        closeModal('carbsModal');
        showToast(`${amount}g koolhydraten gelogd ✓`);
        document.getElementById('carbsAmount').value = '';
        renderLogs();
    }
}

function logMeal() {
    const desc = document.getElementById('mealDesc').value;
    const carbs = parseInt(document.getElementById('mealCarbs').value);
    const insulin = parseFloat(document.getElementById('mealInsulin').value) || 0;
    
    if (desc && carbs > 0) {
        state.mealLogs.push({ time: new Date().toISOString(), description: desc, carbs, insulin });
        saveState();
        updateIOBDisplay();
        closeModal('mealModal');
        showToast(`Maaltijd gelogd: ${desc} ✓`);
        document.getElementById('mealDesc').value = '';
        document.getElementById('mealCarbs').value = '';
        document.getElementById('mealInsulin').value = '';
        renderLogs();
    }
}

// ==================== WORKOUT FUNCTIONS ====================

function startWorkout() {
    const readiness = calculateReadiness();
    if (readiness.score < 50) {
        showToast('⚠️ Check eerst de adviezen!');
        return;
    }
    
    state.activeWorkout = {
        startTime: new Date().toISOString(),
        glucosePre: state.currentGlucose,
        type: trainingSchedule[new Date().getDay()].type
    };
    saveState();
    showToast('Training gestart! 💪');
    
    // Show post-workout modal after demo time
    setTimeout(endWorkout, 3000);
}

function endWorkout() {
    if (!state.activeWorkout) return;
    
    state.workoutLogs.push({
        date: state.activeWorkout.startTime,
        type: state.activeWorkout.type,
        duration: trainingSchedule[new Date().getDay()].duration,
        glucosePre: state.activeWorkout.glucosePre,
        glucosePost: state.currentGlucose,
        hypo: state.currentGlucose && state.currentGlucose < 4
    });
    
    state.activeWorkout = null;
    updateAchievements();
    saveState();
    openModal('postWorkoutModal');
    updatePostWorkoutSuggestions();
}

function updatePostWorkoutSuggestions() {
    const el = document.getElementById('postWorkoutCarbSuggestion');
    if (state.currentGlucose && state.currentGlucose < 8) {
        el.style.display = 'flex';
        document.getElementById('suggestedCarbs').textContent = Math.round((8 - state.currentGlucose) * 5 + 15);
    } else {
        el.style.display = 'none';
    }
}

// ==================== CARB CALCULATOR ====================

function calculateCarbs() {
    const glucose = parseFloat(document.getElementById('calcCurrentGlucose').value) || state.currentGlucose;
    const duration = parseInt(document.getElementById('calcDuration').value);
    const intensity = document.getElementById('calcIntensity').value;
    
    if (!glucose) { showToast('Voer je huidige glucose in'); return; }
    
    const target = state.settings.targetGlucose;
    let carbsNeeded = glucose < target ? (target - glucose) * 10 : 0;
    
    const carbsPerHour = { low: 20, medium: 40, high: 60 };
    const exerciseCarbs = (duration / 60) * carbsPerHour[intensity];
    const iobEffect = calculateIOB() * state.settings.correctionFactor * 10;
    
    let total = Math.max(0, Math.round((carbsNeeded + exerciseCarbs - calculateCOB() + iobEffect) / 5) * 5);
    
    document.getElementById('carbCalcResult').style.display = 'flex';
    document.getElementById('calcResultCarbs').textContent = total;
}

// ==================== PATTERN RECOGNITION ====================

function analyzePatterns() {
    const patterns = [];
    if (state.workoutLogs.length < 4) return patterns;
    
    const eveningWorkouts = state.workoutLogs.filter(w => {
        const hour = new Date(w.date).getHours();
        return hour >= 18 && hour <= 22 && w.glucosePre && w.glucosePost;
    });
    
    if (eveningWorkouts.length >= 3) {
        const avgDrop = eveningWorkouts.reduce((sum, w) => sum + (w.glucosePre - w.glucosePost), 0) / eveningWorkouts.length;
        if (avgDrop > 2) {
            patterns.push({
                icon: '📉',
                title: 'Avondtraining glucosedaling',
                text: `Bij avondtraining daalt je glucose gemiddeld ${avgDrop.toFixed(1)} mmol/L. Start iets hoger.`
            });
        }
    }
    
    const hypoRate = (state.workoutLogs.filter(w => w.hypo).length / state.workoutLogs.length) * 100;
    if (hypoRate > 20) {
        patterns.push({
            icon: '⚠️',
            title: 'Hypo risico',
            text: `${hypoRate.toFixed(0)}% van je trainingen had een hypo. Overweeg meer koolhydraten vooraf.`
        });
    }
    
    return patterns;
}

// ==================== ACHIEVEMENTS ====================

function updateAchievements() {
    const count = state.workoutLogs.length;
    if (count >= 1) state.achievements.firstWorkout = true;
    if (count >= 5) state.achievements.fiveWorkouts = true;
    if (count >= 10) state.achievements.tenWorkouts = true;
    
    let streak = 0;
    for (let i = state.workoutLogs.length - 1; i >= 0; i--) {
        if (!state.workoutLogs[i].hypo) streak++; else break;
    }
    state.achievements.noHypoStreak = streak;
    saveState();
}

// ==================== RENDERING ====================

function renderAll() {
    renderGlucoseDisplay();
    renderTodayTraining();
    renderWeekBar();
    renderSelectedDayTraining();
    renderPreWorkoutChecklist();
    renderLogs();
    renderStats();
    renderAchievements();
    renderPatterns();
    loadSettings();
}

function renderTodayTraining() {
    const t = trainingSchedule[new Date().getDay()];
    document.getElementById('todayTraining').innerHTML = `
        <div class="card-header"><span class="card-title">Training Vandaag</span><span class="card-icon">${t.icon}</span></div>
        <div class="training-type-badge ${t.type}">${t.icon} ${t.type}</div>
        <div class="training-title">${t.title}</div>
        <div class="training-desc">${t.description}</div>
        ${t.duration > 0 ? `<div class="training-meta"><span class="meta-item">⏱️ ${t.duration} min</span>${t.zone ? `<span class="meta-item">📊 ${t.zone}</span>` : ''}</div>` : ''}
        ${t.route ? `<div class="advice-box success"><div class="advice-title">🗺️ Aanbevolen route</div><div class="advice-text">${t.route}</div></div>` : ''}
    `;
}

function renderWeekBar() {
    const today = new Date().getDay();
    document.getElementById('weekBar').innerHTML = [0,1,2,3,4,5,6].map(day => {
        const t = trainingSchedule[day];
        const date = new Date(); date.setDate(date.getDate() - today + day);
        return `<div class="week-day ${day === state.selectedDay ? 'active' : ''} ${day === today ? 'today' : ''}" onclick="selectDay(${day})">
            <div class="week-day-name">${dayNames[day]}</div>
            <div class="week-day-num">${date.getDate()}</div>
            <div class="week-day-icon">${t.icon}</div>
        </div>`;
    }).join('');
}

function selectDay(day) {
    state.selectedDay = day;
    renderWeekBar();
    renderSelectedDayTraining();
}

function renderSelectedDayTraining() {
    const t = trainingSchedule[state.selectedDay];
    const exercises = t.exercises ? `<div class="exercise-list">${t.exercises.map(e => 
        `<div class="exercise-item"><span class="exercise-name">${e.name}</span><span class="exercise-reps">${e.reps}</span></div>`
    ).join('')}</div>` : '';
    
    document.getElementById('selectedDayTraining').innerHTML = `
        <div class="card training-card">
            <div class="training-type-badge ${t.type}">${t.icon} ${t.type}</div>
            <div class="training-title">${t.title}</div>
            <div class="training-desc">${t.description}</div>
            ${t.duration > 0 ? `<div class="training-meta"><span class="meta-item">⏱️ ${t.duration} min</span>${t.intensity !== 'none' ? `<span class="meta-item">⚡ ${t.intensity}</span>` : ''}</div>` : ''}
            ${exercises}
            ${t.route ? `<div class="advice-box success" style="margin-top:16px"><div class="advice-title">🗺️ Aanbevolen Zwift route</div><div class="advice-text">${t.route}</div></div>` : ''}
        </div>
    `;
}

function renderPreWorkoutChecklist() {
    const iob = calculateIOB();
    const g = state.currentGlucose;
    const target = state.settings.targetGlucose;
    
    const items = [
        { text: 'Glucose gemeten', checked: g !== null },
        { text: `Glucose boven ${target - 1} mmol/L`, checked: g && g >= target - 1 },
        { text: 'Actieve insuline < 1 EH', checked: iob < 1 },
        { text: 'Glucose tabletten bij de hand', checked: false },
        { text: 'Water klaar', checked: false }
    ];
    
    document.getElementById('checklistItems').innerHTML = items.map((item, i) => 
        `<div class="checklist-item ${item.checked ? 'checked' : ''}" onclick="toggleCheckItem(this)">
            <div class="checklist-checkbox">${item.checked ? '✓' : ''}</div>
            <span class="checklist-text">${item.text}</span>
        </div>`
    ).join('');
}

function toggleCheckItem(el) {
    el.classList.toggle('checked');
    el.querySelector('.checklist-checkbox').textContent = el.classList.contains('checked') ? '✓' : '';
}

function renderLogs() {
    const today = new Date().toDateString();
    const allLogs = [
        ...state.insulinLogs.map(l => ({ ...l, logType: 'insulin' })),
        ...state.carbLogs.map(l => ({ ...l, logType: 'carbs' })),
        ...state.mealLogs.map(l => ({ ...l, logType: 'meal' })),
        ...state.glucoseLogs.map(l => ({ ...l, logType: 'glucose' }))
    ].filter(l => new Date(l.time).toDateString() === today)
     .sort((a, b) => new Date(b.time) - new Date(a.time));
    
    const container = document.getElementById('todayLogs');
    if (allLogs.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);font-size:14px;">Nog geen logs vandaag.</p>';
        return;
    }
    
    container.innerHTML = allLogs.map(log => {
        const time = new Date(log.time);
        const timeStr = `${time.getHours().toString().padStart(2,'0')}:${time.getMinutes().toString().padStart(2,'0')}`;
        let content = '', label = '';
        
        if (log.logType === 'insulin') { label = 'Insuline'; content = `<span class="log-value">${log.amount} EH</span> ${log.type}`; }
        else if (log.logType === 'carbs') { label = 'Koolhydraten'; content = `<span class="log-value">${log.amount}g</span> ${log.type}`; }
        else if (log.logType === 'meal') { label = 'Maaltijd'; content = `${log.description}: <span class="log-value">${log.carbs}g</span>, <span class="log-value">${log.insulin} EH</span>`; }
        else if (log.logType === 'glucose') { label = 'Glucose'; content = `<span class="log-value">${log.value} mmol/L</span>`; }
        
        return `<div class="log-entry"><div class="log-header"><span class="log-time">${timeStr}</span><span class="log-type ${log.logType}">${label}</span></div><div class="log-content">${content}</div></div>`;
    }).join('');
}

function renderStats() {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const thisWeek = state.workoutLogs.filter(w => new Date(w.date) > weekAgo);
    
    document.getElementById('statWorkouts').textContent = thisWeek.length;
    document.getElementById('statHypos').textContent = thisWeek.filter(w => w.hypo).length;
    
    const glucoseValues = thisWeek.filter(w => w.glucosePre).map(w => w.glucosePre);
    if (glucoseValues.length > 0) {
        document.getElementById('statAvgGlucose').textContent = (glucoseValues.reduce((a,b) => a+b, 0) / glucoseValues.length).toFixed(1);
    }
    
    const inRange = state.glucoseLogs.filter(g => g.value >= 4 && g.value <= 10).length;
    if (state.glucoseLogs.length > 0) {
        document.getElementById('statTimeInRange').textContent = Math.round((inRange / state.glucoseLogs.length) * 100) + '%';
    }
}

function renderAchievements() {
    const achievements = [];
    if (state.achievements.firstWorkout) achievements.push({ icon: '🎯', title: 'Eerste Training', desc: 'Je bent begonnen!' });
    if (state.achievements.fiveWorkouts) achievements.push({ icon: '🔥', title: '5 Trainingen', desc: 'Je bouwt een routine!' });
    if (state.achievements.tenWorkouts) achievements.push({ icon: '💪', title: '10 Trainingen', desc: 'Doorzetter!' });
    if (state.achievements.noHypoStreak >= 3) achievements.push({ icon: '🛡️', title: `${state.achievements.noHypoStreak}x Geen Hypo`, desc: 'Stabiel sporten!' });
    
    const el = document.getElementById('achievements');
    el.innerHTML = achievements.length === 0 
        ? '<p style="color:var(--text-secondary);font-size:14px;">Voltooi je eerste training om achievements te verdienen!</p>'
        : achievements.map(a => `<div class="achievement"><div class="achievement-icon">${a.icon}</div><div class="achievement-info"><h4>${a.title}</h4><p>${a.desc}</p></div></div>`).join('');
}

function renderPatterns() {
    const patterns = analyzePatterns();
    const el = document.getElementById('patterns');
    el.innerHTML = patterns.length === 0 
        ? '<p style="color:var(--text-secondary);font-size:14px;">Na een paar trainingen verschijnen hier persoonlijke inzichten...</p>'
        : patterns.map(p => `<div class="advice-box" style="margin-bottom:12px"><div class="advice-title">${p.icon} ${p.title}</div><div class="advice-text">${p.text}</div></div>`).join('');
}

// ==================== SETTINGS ====================

function loadSettings() {
    document.getElementById('targetGlucose').value = state.settings.targetGlucose;
    document.getElementById('insulinDuration').value = state.settings.insulinDuration;
    document.getElementById('correctionFactor').value = state.settings.correctionFactor;
    document.getElementById('carbRatio').value = state.settings.carbRatio;
    document.getElementById('kidsBedtime').value = state.settings.kidsBedtime;
    document.getElementById('workoutTime').value = state.settings.workoutTime;
    
    document.getElementById('toggleReminders').classList.toggle('active', state.settings.notifications.reminders);
    document.getElementById('togglePostWorkout').classList.toggle('active', state.settings.notifications.postWorkout);
    document.getElementById('toggleNightCheck').classList.toggle('active', state.settings.notifications.nightCheck);
    
    updateDexcomStatus();
}

function saveSettings() {
    state.settings.targetGlucose = parseFloat(document.getElementById('targetGlucose').value);
    state.settings.insulinDuration = parseFloat(document.getElementById('insulinDuration').value);
    state.settings.correctionFactor = parseFloat(document.getElementById('correctionFactor').value);
    state.settings.carbRatio = parseInt(document.getElementById('carbRatio').value);
    state.settings.kidsBedtime = document.getElementById('kidsBedtime').value;
    state.settings.workoutTime = document.getElementById('workoutTime').value;
    saveState();
    showToast('Instellingen opgeslagen ✓');
}

function toggleSetting(el) {
    el.classList.toggle('active');
    const id = el.id;
    if (id === 'toggleReminders') state.settings.notifications.reminders = el.classList.contains('active');
    if (id === 'togglePostWorkout') state.settings.notifications.postWorkout = el.classList.contains('active');
    if (id === 'toggleNightCheck') state.settings.notifications.nightCheck = el.classList.contains('active');
    saveState();
}

function saveWellbeing() {
    state.wellbeingLogs.push({
        date: new Date().toISOString(),
        stress: parseInt(document.getElementById('stressSlider').value),
        sleep: parseInt(document.getElementById('sleepSlider').value)
    });
    saveState();
    renderPatterns();
    showToast('Welzijn opgeslagen ✓');
}

// ==================== DEXCOM ====================

function connectDexcom() {
    const username = document.getElementById('dexcomUsername').value;
    const password = document.getElementById('dexcomPassword').value;
    
    if (!username || !password) { showToast('Vul gebruikersnaam en wachtwoord in'); return; }
    
    state.dexcomConnected = true;
    saveState();
    updateDexcomStatus();
    showToast('Dexcom verbonden! ✓');
}

function updateDexcomStatus() {
    const dot = document.getElementById('dexcomStatus');
    const text = document.getElementById('dexcomStatusText');
    dot.className = 'status-dot ' + (state.dexcomConnected ? 'connected' : 'disconnected');
    text.textContent = state.dexcomConnected ? 'Verbonden' : 'Niet verbonden';
}

// ==================== UI HELPERS ====================

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`page-${pageId}`).classList.add('active');
    event.currentTarget.classList.add('active');
    if (pageId === 'stats') { renderStats(); renderAchievements(); renderPatterns(); }
}

function openSettings() {
    showPage('settings');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
    if (id === 'carbCalcModal' && state.currentGlucose) {
        document.getElementById('calcCurrentGlucose').value = state.currentGlucose;
    }
}

function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function toggleCheck(el) {
    el.classList.toggle('checked');
    el.querySelector('.checklist-checkbox').textContent = el.classList.contains('checked') ? '✓' : '';
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function setupEventListeners() {
    document.querySelectorAll('.modal-overlay').forEach(m => {
        m.addEventListener('click', e => { if (e.target === m) m.classList.remove('active'); });
    });
    document.getElementById('glucoseInput').addEventListener('keypress', e => { if (e.key === 'Enter') updateGlucose(); });
}

// ==================== SERVICE WORKER ====================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(e => console.log('SW failed:', e));
    });
}

// ==================== INIT ====================

document.addEventListener('DOMContentLoaded', init);
