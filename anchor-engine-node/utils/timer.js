/**
 * Timer Utility for Performance Measurement
 *
 * Provides timing functionality to measure how long processes take
 */
export class Timer {
    startTime;
    lapTime;
    label;
    constructor(label = 'Timer') {
        this.label = label;
        this.startTime = Date.now();
        this.lapTime = this.startTime;
    }
    /**
     * Get the elapsed time since the timer started
     */
    elapsed() {
        return Date.now() - this.startTime;
    }
    /**
     * Get the time elapsed since the last lap
     */
    lap() {
        const currentTime = Date.now();
        const lapDuration = currentTime - this.lapTime;
        this.lapTime = currentTime;
        return lapDuration;
    }
    /**
     * Format time in milliseconds to human-readable format
     */
    static formatTime(ms) {
        if (ms < 1000) {
            return `${ms}ms`;
        }
        else if (ms < 60000) {
            const seconds = (ms / 1000).toFixed(2);
            return `${seconds}s`;
        }
        else {
            const minutes = (ms / 60000).toFixed(2);
            return `${minutes}m`;
        }
    }
    /**
     * Log the elapsed time with a message
     */
    log(message) {
        const elapsed = this.elapsed();
        console.log(`[${this.label}] ${message} (${Timer.formatTime(elapsed)})`);
    }
    /**
     * Log a lap time with a message
     */
    logLap(message) {
        const lap = this.lap();
        console.log(`[${this.label}] ${message} (+${Timer.formatTime(lap)})`);
    }
    /**
     * Log the total elapsed time and reset the timer
     */
    logTotalAndReset(message) {
        const elapsed = this.elapsed();
        console.log(`[${this.label}] ${message} (Total: ${Timer.formatTime(elapsed)})`);
        this.reset();
    }
    /**
     * Reset the timer
     */
    reset() {
        this.startTime = Date.now();
        this.lapTime = this.startTime;
    }
}
