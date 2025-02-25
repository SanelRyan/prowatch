const { app, Notification } = require('electron');
const Store = require('electron-store');
const store = new Store();

class TimerManager {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.activeTimers = new Map();
        this.loadTimers();
    }

    loadTimers() {
        const tasks = store.get('tasksByDate') || {};
        const today = new Date().toISOString().split('T')[0];
        
        if (tasks[today]) {
            tasks[today].forEach(task => {
                if (task.isRunning) {
                    this.startTimer(task.id, task.remainingSeconds, task.name);
                }
            });
        }
    }

    startTimer(id, remainingSeconds, taskName) {
        if (this.activeTimers.has(id)) {
            clearInterval(this.activeTimers.get(id));
        }

        const interval = setInterval(() => {
            remainingSeconds--;
            
            this.mainWindow.webContents.send('timer-tick', {
                id,
                remainingSeconds
            });

            if (remainingSeconds <= 0) {
                clearInterval(interval);
                this.activeTimers.delete(id);
                
                new Notification({
                    title: 'Task Complete',
                    body: `${taskName} has been completed!`,
                    icon: './src/assets/icon.png'
                }).show();

                this.mainWindow.webContents.send('timer-complete', {
                    id,
                    taskName
                });
            }
        }, 1000);

        this.activeTimers.set(id, interval);
    }

    stopTimer(id) {
        if (this.activeTimers.has(id)) {
            clearInterval(this.activeTimers.get(id));
            this.activeTimers.delete(id);
        }
    }

    clearAllTimers() {
        this.activeTimers.forEach(interval => clearInterval(interval));
        this.activeTimers.clear();
    }
}

module.exports = TimerManager; 