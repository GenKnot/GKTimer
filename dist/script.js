class Timer {
    constructor() {
        this.session = null;
        this.interval = null;
        this.startTime = null;
        if (window.__TAURI_INVOKE__) {
            this.invoke = window.__TAURI_INVOKE__;
        } else {
            this.invoke = this.mockInvoke;
        }
        
        
        this.elements = {
            statusDot: document.getElementById('statusDot'),
            timeDisplay: document.getElementById('timeDisplay'),
            sessionStatus: document.getElementById('sessionStatus'),
            startBtn: document.getElementById('startBtn'),
            stopBtn: document.getElementById('stopBtn'),
            todayWorkHeader: document.getElementById('todayWorkHeader'),
            todayDate: document.getElementById('todayDate'),
            totalWorkTime: document.getElementById('totalWorkTime'),
            workDetails: document.getElementById('workDetails'),
            sessionsList: document.getElementById('sessionsList'),
            themeToggle: document.getElementById('themeToggle')
        };
        
        this.init();
    }
    
    async mockInvoke(cmd, args = {}) {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        switch (cmd) {
            case 'start_timer':
                return { id: 'mock', start_time: new Date().toISOString() };
            case 'stop_timer':
                return { id: 'mock', start_time: new Date(Date.now() - 3600000).toISOString(), end_time: new Date().toISOString(), duration_minutes: 60 };
            case 'get_active_session':
                return null;
            case 'export_work_sessions':
                return { total_sessions: 0, total_duration_minutes: 0, sessions: [] };
            default:
                return {};
        }
    }
    
    init() {
        this.bindEvents();
        this.updateDate();
        this.loadActiveSession();
        this.loadTodayWorkTime();
        this.initTheme();
    }
    
    bindEvents() {
        this.elements.startBtn.addEventListener('click', () => this.start());
        this.elements.stopBtn.addEventListener('click', () => this.stop());
        this.elements.todayWorkHeader.addEventListener('click', () => this.toggleWorkDetails());
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
    }
    
    formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    
    formatDuration(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? (mins > 0 ? `${hours}h ${mins}m` : `${hours}h`) : `${mins}m`;
    }
    
    formatDateTime(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        let dateLabel;
        if (date.toDateString() === today.toDateString()) {
            dateLabel = 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            dateLabel = 'Yesterday';
        } else {
            dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        
        const time = date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
        
        return { dateLabel, time };
    }
    
    updateDisplay() {
        if (!this.startTime) return;
        
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        this.elements.timeDisplay.textContent = this.formatTime(elapsed);
    }
    
    async start() {
        try {
            this.elements.startBtn.disabled = true;
            this.elements.stopBtn.disabled = false;
            this.elements.statusDot.classList.add('active');
            
            this.startTime = Date.now();
            this.interval = setInterval(() => this.updateDisplay(), 1000);
            
            const { time } = this.formatDateTime(new Date().toISOString());
            this.elements.sessionStatus.textContent = `Started at ${time}`;
            
            this.session = await this.invoke('start_timer');
            this.loadTodayWorkTime();
            
        } catch (error) {
            console.error('Start timer error:', error);
            this.reset();
            alert('Failed to start timer');
        }
    }
    
    async stop() {
        try {
            if (this.interval) {
                clearInterval(this.interval);
                this.interval = null;
            }
            
            if (this.session) {
                const result = await this.invoke('stop_timer');
                const duration = this.formatDuration(result.duration_minutes || 0);
                this.elements.sessionStatus.textContent = `Completed - ${duration}`;
                this.loadTodayWorkTime();
            }
            
            this.reset();
            
        } catch (error) {
            console.error('Stop timer error:', error);
            this.reset();
            alert('Failed to stop timer');
        }
    }
    
    reset() {
        this.elements.startBtn.disabled = false;
        this.elements.stopBtn.disabled = true;
        this.elements.statusDot.classList.remove('active');
        this.elements.timeDisplay.textContent = '00:00:00';
        this.session = null;
        this.startTime = null;
        
        if (!this.session) {
            this.elements.sessionStatus.textContent = 'Ready';
        }
    }
    
    async loadActiveSession() {
        try {
            const session = await this.invoke('get_active_session');
            if (session) {
                this.session = session;
                this.startTime = new Date(session.start_time).getTime();
                this.elements.startBtn.disabled = true;
                this.elements.stopBtn.disabled = false;
                this.elements.statusDot.classList.add('active');
                
                const { time } = this.formatDateTime(session.start_time);
                this.elements.sessionStatus.textContent = `Started at ${time}`;
                
                this.interval = setInterval(() => this.updateDisplay(), 1000);
                this.updateDisplay();
            }
        } catch (error) {
            console.error('Failed to load active session');
        }
    }
    
    async export() {
        const startDate = this.elements.startDate.value;
        const endDate = this.elements.endDate.value;
        
        if (!startDate || !endDate) {
            alert('Please select both dates');
            return;
        }
        
        try {
            const startDateTime = new Date(startDate + 'T00:00:00Z').toISOString();
            const endDateTime = new Date(endDate + 'T23:59:59Z').toISOString();
            
            const summary = await this.invoke('export_work_sessions', { 
                startDate: startDateTime, 
                endDate: endDateTime 
            });
            
            this.displayResults(summary);
            
        } catch (error) {
            alert('Failed to export sessions');
        }
    }
    
    displayResults(summary) {
        this.elements.totalSessions.textContent = summary.total_sessions;
        this.elements.totalTime.textContent = this.formatDuration(summary.total_duration_minutes);
        
        this.elements.sessionsList.innerHTML = '';
        
        if (summary.sessions.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No sessions found';
            this.elements.sessionsList.appendChild(empty);
        } else {
            summary.sessions.forEach(session => {
                const item = document.createElement('div');
                item.className = 'session';
                
                const { dateLabel, time: startTime } = this.formatDateTime(session.start_time);
                const endTime = session.end_time ? this.formatDateTime(session.end_time).time : 'Running';
                const duration = this.formatDuration(session.duration_minutes || 0);
                
                item.innerHTML = `
                    <div class="session-info">
                        <div class="date">${dateLabel}</div>
                        <div class="time">${startTime} - ${endTime}</div>
                    </div>
                    <div class="session-duration">${duration}</div>
                `;
                
                this.elements.sessionsList.appendChild(item);
            });
        }
        
        this.elements.results.classList.add('show');
    }
    
    updateDate() {
        const now = new Date();
        const dateOptions = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            weekday: 'long' 
        };
        
        this.elements.todayDate.textContent = now.toLocaleDateString('en-US', dateOptions);
    }
    
    toggleWorkDetails() {
        const details = this.elements.workDetails;
        if (details.style.display === 'none') {
            details.style.display = 'block';
            this.loadTodaySessions();
        } else {
            details.style.display = 'none';
        }
    }
    
    async loadTodayWorkTime() {
        try {
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
            
            const result = await this.invoke('export_work_sessions', {
                startDate: startOfDay.toISOString(),
                endDate: endOfDay.toISOString()
            });
            
            const totalMinutes = result.total_duration_minutes || 0;
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            
            this.elements.totalWorkTime.textContent = `${hours}h ${minutes}m`;
        } catch (error) {
            console.error('Failed to load today work time:', error);
            this.elements.totalWorkTime.textContent = '0h 0m';
        }
    }
    
    async loadTodaySessions() {
        try {
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
            
            const result = await this.invoke('export_work_sessions', {
                startDate: startOfDay.toISOString(),
                endDate: endOfDay.toISOString()
            });
            
            this.displaySessions(result.sessions);
        } catch (error) {
            console.error('Failed to load today sessions:', error);
            this.elements.sessionsList.innerHTML = '<div class="session-item">No sessions found</div>';
        }
    }
    
    displaySessions(sessions) {
        if (sessions.length === 0) {
            this.elements.sessionsList.innerHTML = '<div class="session-item">No sessions today</div>';
            return;
        }
        
        this.elements.sessionsList.innerHTML = sessions.map(session => {
            const startTime = new Date(session.start_time);
            const endTime = session.end_time ? new Date(session.end_time) : null;
            const duration = session.duration_minutes || 0;
            
            const startTimeStr = startTime.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit',
                hour12: false 
            });
            
            const endTimeStr = endTime ? endTime.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit',
                hour12: false 
            }) : 'Running...';
            
            const durationStr = duration > 0 ? `${Math.floor(duration / 60)}h ${duration % 60}m` : '0m';
            
            return `
                <div class="session-item">
                    <div class="session-time">${startTimeStr} - ${endTimeStr}</div>
                    <div class="session-duration">${durationStr}</div>
                </div>
            `;
        }).join('');
    }
    
    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
    }
    
    updateThemeIcon(theme) {
        this.elements.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}

document.addEventListener('DOMContentLoaded', () => new Timer());