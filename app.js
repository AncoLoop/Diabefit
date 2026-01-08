// DiabeFit - Training App voor Type 1 Diabetes
// =============================================

// Training Schedule Data
const trainingSchedule = {
    0: { // Zondag
        type: 'rest',
        title: 'Rustdag',
        description: 'Vandaag geen training gepland. Geniet van je vrije dag en herstel goed.',
        duration: 0,
        icon: '😴',
        exercises: []
    },
    1: { // Maandag
        type: 'cycling',
        title: 'Zone 2 Herstelrit',
        description: 'Rustige duurrit in Zone 2. Focus op een ontspannen tempo waarbij je nog kunt praten. Gebruik Zwift "Foundation" of een vlakke route.',
        duration: 45,
        icon: '🚴',
        intensity: 'Laag',
        zone: 'Zone 2 (60-70% max HR)',
        exercises: []
    },
    2: { // Dinsdag
        type: 'strength',
        title: 'Krachttraining',
        description: 'Full-body circuit training. Focus op goede techniek en gecontroleerde bewegingen. 3 rondes met 60 seconden rust tussen rondes.',
        duration: 30,
        icon: '💪',
        intensity: 'Gemiddeld',
        exercises: [
            { name: 'Squats', reps: '15x' },
            { name: 'Push-ups', reps: '10-15x' },
            { name: 'Lunges', reps: '10x per been' },
            { name: 'Plank', reps: '30-45 sec' },
            { name: 'Glute bridges', reps: '15x' },
            { name: 'Superman (rug)', reps: '12x' }
        ]
    },
    3: { // Woensdag
        type: 'cycling',
        title: 'Interval Training',
        description: '4x4 minuten op 85-90% van je max hartslag met 3 minuten actief herstel. Zoek in Zwift naar "FTP Builder" of "Build Me Up" workouts.',
        duration: 50,
        icon: '🚴',
        intensity: 'Hoog',
        zone: 'Zone 4-5 (85-90% max HR)',
        exercises: []
    },
    4: { // Donderdag
        type: 'strength',
        title: 'Krachttraining',
        description: 'Full-body circuit training. Focus op goede techniek en gecontroleerde bewegingen. 3 rondes met 60 seconden rust tussen rondes.',
        duration: 30,
        icon: '💪',
        intensity: 'Gemiddeld',
        exercises: [
            { name: 'Squats', reps: '15x' },
            { name: 'Push-ups', reps: '10-15x' },
            { name: 'Lunges', reps: '10x per been' },
            { name: 'Plank', reps: '30-45 sec' },
            { name: 'Glute bridges', reps: '15x' },
            { name: 'Superman (rug)', reps: '12x' }
        ]
    },
    5: { // Vrijdag
        type: 'rest',
        title: 'Rust of Mobiliteit',
        description: 'Optioneel: 15 minuten lichte stretching of yoga. Luister naar je lichaam.',
        duration: 15,
        icon: '🧘',
        exercises: []
    },
    6: { // Zaterdag
        type: 'cycling',
        title: 'Lange Duurrit',
        description: 'Langere rit op gemiddeld tempo. Probeer een Zwift groepsrit of een route met wat klimwerk. Neem voldoende koolhydraten mee!',
        duration: 75,
        icon: '🚴',
        intensity: 'Gemiddeld',
        zone: 'Zone 2-3 (65-80% max HR)',
        exercises: []
    }
};

// Day names in Dutch
const dayNames = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
const dayNamesFull = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];

// App State
let state = {
    currentGlucose: null,
    glucoseTime: null,
    selectedDay: new Date().getDay(),
    notificationsEnabled: true,
    rescheduledTrainings: {}, // { originalDay: newDay }
    completedTrainings: []
};

// Load state from localStorage
function loadState() {
    const saved = localStorage.getItem('diabefit-state');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state = { ...state, ...parsed };
        } catch (e) {
            console.error('Failed to load state:', e);
        }
    }
}

// Save state to localStorage
function saveState() {
    localStorage.setItem('diabefit-state', JSON.stringify(state));
}

// Initialize the app
function init() {
    loadState();
    renderDaySelector();
    renderWeekGrid();
    renderTrainingCard();
    updateGlucoseDisplay();
    setupEventListeners();
    requestNotificationPermission();
    scheduleNotifications();
}

// Render day selector
function renderDaySelector() {
    const container = document.getElementById('daySelector');
    const today = new Date();
    const currentDay = today.getDay();
    
    container.innerHTML = '';
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - currentDay + i);
        
        const dayNum = date.getDate();
        const dayIndex = date.getDay();
        const training = getTrainingForDay(dayIndex);
        
        const btn = document.createElement('button');
        btn.className = 'day-btn';
        if (dayIndex === state.selectedDay) btn.classList.add('active');
        if (dayIndex === currentDay) btn.classList.add('today');
        if (training.type === 'rest') btn.classList.add('rest');
        
        btn.innerHTML = `
            <span class="day-name">${dayNames[dayIndex]}</span>
            <span class="day-num">${dayNum}</span>
        `;
        
        btn.addEventListener('click', () => {
            state.selectedDay = dayIndex;
            renderDaySelector();
            renderTrainingCard();
        });
        
        container.appendChild(btn);
    }
}

// Render week grid
function renderWeekGrid() {
    const container = document.getElementById('weekGrid');
    const today = new Date().getDay();
    
    container.innerHTML = '';
    
    for (let i = 0; i < 7; i++) {
        const training = getTrainingForDay(i);
        const day = document.createElement('div');
        day.className = 'week-day';
        if (i === today) day.classList.add('today');
        
        day.innerHTML = `
            <div class="week-day-name">${dayNames[i]}</div>
            <div class="week-day-icon">${training.icon}</div>
            <div class="week-day-type">${training.type === 'cycling' ? 'Fiets' : training.type === 'strength' ? 'Kracht' : 'Rust'}</div>
        `;
        
        container.appendChild(day);
    }
}

// Get training for a specific day (considering rescheduled trainings)
function getTrainingForDay(dayIndex) {
    // Check if another training was moved to this day
    for (const [original, target] of Object.entries(state.rescheduledTrainings)) {
        if (parseInt(target) === dayIndex) {
            return trainingSchedule[parseInt(original)];
        }
    }
    
    // Check if this day's training was moved elsewhere
    if (state.rescheduledTrainings[dayIndex] !== undefined) {
        return trainingSchedule[0]; // Return rest day
    }
    
    return trainingSchedule[dayIndex];
}

// Render training card
function renderTrainingCard() {
    const container = document.getElementById('trainingCardContainer');
    const training = getTrainingForDay(state.selectedDay);
    const isToday = state.selectedDay === new Date().getDay();
    
    let exerciseListHTML = '';
    if (training.exercises && training.exercises.length > 0) {
        exerciseListHTML = `
            <div class="exercise-list">
                ${training.exercises.map(ex => `
                    <div class="exercise-item">
                        <span class="exercise-name">${ex.name}</span>
                        <span class="exercise-reps">${ex.reps}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    let metaHTML = '';
    if (training.duration > 0) {
        metaHTML = `
            <div class="training-meta">
                <div class="meta-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span>${training.duration} min</span>
                </div>
                ${training.intensity ? `
                <div class="meta-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                    <span>${training.intensity}</span>
                </div>
                ` : ''}
            </div>
        `;
    }
    
    let actionsHTML = '';
    if (training.type !== 'rest') {
        actionsHTML = `
            <div class="training-actions">
                <button class="btn-primary" id="startTraining">
                    ${isToday ? 'Start training' : 'Bekijk details'}
                </button>
                <button class="btn-secondary" id="rescheduleBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                </button>
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="training-card ${training.type}">
            <div class="training-type ${training.type}">
                <span>${training.icon}</span>
                <span>${training.type === 'cycling' ? 'Fietsen' : training.type === 'strength' ? 'Kracht' : 'Rust'}</span>
            </div>
            <h3 class="training-title">${training.title}</h3>
            <p class="training-description">${training.description}</p>
            ${training.zone ? `<p class="training-description" style="margin-top: -8px;"><strong>Zone:</strong> ${training.zone}</p>` : ''}
            ${metaHTML}
            ${exerciseListHTML}
            ${actionsHTML}
        </div>
    `;
    
    // Add event listeners
    const rescheduleBtn = document.getElementById('rescheduleBtn');
    if (rescheduleBtn) {
        rescheduleBtn.addEventListener('click', openRescheduleModal);
    }
    
    const startBtn = document.getElementById('startTraining');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            showToast('Training gestart! Veel succes! 💪');
        });
    }
}

// Update glucose display
function updateGlucoseDisplay() {
    const valueEl = document.getElementById('glucoseValue');
    const timeEl = document.getElementById('glucoseTime');
    const statusEl = document.getElementById('glucoseStatus');
    const adviceEl = document.getElementById('adviceText');
    
    if (state.currentGlucose !== null) {
        valueEl.textContent = state.currentGlucose.toFixed(1);
        
        // Remove all status classes
        valueEl.classList.remove('low', 'ok', 'high');
        statusEl.classList.remove('low', 'ok', 'high');
        
        let status, statusText, advice;
        const target = 7.5; // Streefwaarde voor sporten
        const glucose = state.currentGlucose;
        
        if (glucose < 4) {
            status = 'low';
            statusText = '⚠️ Te laag - Niet sporten!';
            advice = `Je bloedsuiker is <strong>${glucose} mmol/L</strong>, dit is te laag om te sporten. Neem eerst 15-20 gram snelle koolhydraten (bijv. dextro of druivensap) en wacht 15 minuten. Meet opnieuw tot je boven de ${target} zit.`;
        } else if (glucose < 5) {
            status = 'low';
            statusText = '⚠️ Te laag - Eerst eten!';
            advice = `Je bloedsuiker is <strong>${glucose} mmol/L</strong>. Dit is te laag voor training. Neem 15-20g koolhydraten en wacht tot je richting ${target} gaat.`;
        } else if (glucose < 6.5) {
            status = 'low';
            statusText = '🍌 Aan de lage kant';
            advice = `Je bloedsuiker is <strong>${glucose} mmol/L</strong>. Neem een kleine snack (10-15g koolhydraten) om dichter bij je streefwaarde van ${target} te komen en een hypo te voorkomen.`;
        } else if (glucose >= 6.5 && glucose <= 8.5) {
            status = 'ok';
            statusText = '✅ Perfect - Rond je streefwaarde!';
            advice = `Je bloedsuiker is <strong>${glucose} mmol/L</strong> - ideaal rond je streefwaarde van ${target}! Je kunt veilig sporten. Houd glucose tabletten bij de hand voor het geval dat.`;
        } else if (glucose <= 10) {
            status = 'ok';
            statusText = '✅ Goed - Je kunt sporten';
            advice = `Je bloedsuiker is <strong>${glucose} mmol/L</strong>. Iets boven je streefwaarde van ${target}, maar prima om te sporten. De training zal je glucose waarschijnlijk laten dalen.`;
        } else if (glucose <= 14) {
            status = 'high';
            statusText = '📊 Hoog - Voorzichtig trainen';
            advice = `Je bloedsuiker is <strong>${glucose} mmol/L</strong>, dit is boven je streefwaarde van ${target}. Je kunt trainen, maar check op ketonen bij klachten. Lichte training kan helpen om te dalen.`;
        } else {
            status = 'high';
            statusText = '⚠️ Te hoog - Check ketonen eerst';
            advice = `Je bloedsuiker is <strong>${glucose} mmol/L</strong>, ver boven je streefwaarde van ${target}. Meet eerst je ketonen. Bij ketonen > 0.6 mmol/L: niet sporten. Intensieve training kan je bloedsuiker verder verhogen.`;
        }
        
        valueEl.classList.add(status);
        statusEl.classList.add(status);
        statusEl.innerHTML = `<span>${statusText}</span>`;
        adviceEl.innerHTML = advice;
        
        if (state.glucoseTime) {
            const time = new Date(state.glucoseTime);
            timeEl.textContent = `Gemeten om ${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
        }
    }
}

// Setup event listeners
function setupEventListeners() {
    // Glucose input
    document.getElementById('updateGlucose').addEventListener('click', () => {
        const input = document.getElementById('glucoseInput');
        const value = parseFloat(input.value);
        
        if (value && value >= 1 && value <= 30) {
            state.currentGlucose = value;
            state.glucoseTime = new Date().toISOString();
            saveState();
            updateGlucoseDisplay();
            input.value = '';
            showToast('Bloedsuiker bijgewerkt! ✓');
        } else {
            showToast('Voer een geldige waarde in (1-30)');
        }
    });
    
    // Enter key for glucose input
    document.getElementById('glucoseInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('updateGlucose').click();
        }
    });
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            const mainContent = document.getElementById('mainContent');
            const settingsPanel = document.getElementById('settingsPanel');
            
            if (view === 'settings') {
                mainContent.classList.add('hidden');
                settingsPanel.classList.add('active');
            } else {
                mainContent.classList.remove('hidden');
                settingsPanel.classList.remove('active');
            }
        });
    });
    
    // Settings button
    document.getElementById('settingsBtn').addEventListener('click', () => {
        document.querySelector('[data-view="settings"]').click();
    });
    
    // Notification toggle
    document.getElementById('toggleNotifications').addEventListener('click', function() {
        this.classList.toggle('active');
        state.notificationsEnabled = this.classList.contains('active');
        saveState();
        
        if (state.notificationsEnabled) {
            requestNotificationPermission();
            showToast('Notificaties ingeschakeld');
        } else {
            showToast('Notificaties uitgeschakeld');
        }
    });
    
    // Reschedule modal
    document.getElementById('cancelReschedule').addEventListener('click', closeRescheduleModal);
    document.getElementById('rescheduleModal').addEventListener('click', (e) => {
        if (e.target.id === 'rescheduleModal') {
            closeRescheduleModal();
        }
    });
    
    document.getElementById('confirmReschedule').addEventListener('click', confirmReschedule);
    
    // Notification button
    document.getElementById('notificationBtn').addEventListener('click', () => {
        showToast('Geen nieuwe notificaties');
    });
}

// Reschedule Modal
let selectedRescheduleDay = null;

function openRescheduleModal() {
    const modal = document.getElementById('rescheduleModal');
    const optionsContainer = document.getElementById('rescheduleOptions');
    const today = new Date().getDay();
    
    // Find available days (rest days or days without intense training)
    const availableDays = [];
    for (let i = 0; i < 7; i++) {
        if (i === state.selectedDay) continue; // Skip current day
        if (i === 0) continue; // Skip Sunday (no training)
        
        const training = getTrainingForDay(i);
        // Suggest rest days or Friday (light day)
        if (training.type === 'rest' || i === 5) {
            const date = new Date();
            date.setDate(date.getDate() - today + i);
            availableDays.push({
                dayIndex: i,
                dayName: dayNamesFull[i],
                date: date.getDate(),
                current: training.title
            });
        }
    }
    
    // Also suggest tomorrow if it's not Sunday
    const tomorrow = (today + 1) % 7;
    if (tomorrow !== 0 && !availableDays.find(d => d.dayIndex === tomorrow)) {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        const training = getTrainingForDay(tomorrow);
        availableDays.unshift({
            dayIndex: tomorrow,
            dayName: dayNamesFull[tomorrow],
            date: date.getDate(),
            current: training.title
        });
    }
    
    optionsContainer.innerHTML = availableDays.slice(0, 4).map(day => `
        <div class="reschedule-option" data-day="${day.dayIndex}">
            <div class="option-day">${day.dayName} ${day.date}</div>
            <div class="option-info">Nu: ${day.current}</div>
        </div>
    `).join('');
    
    // Add click handlers
    optionsContainer.querySelectorAll('.reschedule-option').forEach(option => {
        option.addEventListener('click', () => {
            optionsContainer.querySelectorAll('.reschedule-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            selectedRescheduleDay = parseInt(option.dataset.day);
        });
    });
    
    selectedRescheduleDay = null;
    modal.classList.add('active');
}

function closeRescheduleModal() {
    document.getElementById('rescheduleModal').classList.remove('active');
    selectedRescheduleDay = null;
}

function confirmReschedule() {
    if (selectedRescheduleDay === null) {
        showToast('Selecteer eerst een dag');
        return;
    }
    
    // Save the reschedule
    state.rescheduledTrainings[state.selectedDay] = selectedRescheduleDay;
    saveState();
    
    // Update UI
    renderDaySelector();
    renderWeekGrid();
    renderTrainingCard();
    closeRescheduleModal();
    
    showToast(`Training verplaatst naar ${dayNamesFull[selectedRescheduleDay]}`);
}

// Toast notification
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Notification handling
function requestNotificationPermission() {
    if ('Notification' in window && state.notificationsEnabled) {
        Notification.requestPermission();
    }
}

function scheduleNotifications() {
    if (!('Notification' in window) || !state.notificationsEnabled) return;
    
    // Check every minute for scheduled notifications
    setInterval(() => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        
        // Training reminder at 19:45
        if (hours === 19 && minutes === 45) {
            const today = now.getDay();
            const training = getTrainingForDay(today);
            
            if (training.type !== 'rest' && Notification.permission === 'granted') {
                new Notification('DiabeFit - Trainingsherinnering', {
                    body: `Over 15 minuten: ${training.title}. Vergeet niet je bloedsuiker te meten!`,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png'
                });
            }
        }
    }, 60000);
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
