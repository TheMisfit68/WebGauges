class AudioAlarm {

    constructor(audioContext = null) {
        this.audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
        this.oscillator = null;
        this.alarmState = "none"; // "none", "max", "maxmax"
        this.pendingTimeouts = [];
    }

    check(nettoPower, warningThreshold, peakThreshold, hysteresis = 200) {
        const previousState = this.alarmState;

        // Check if we're above thresholds
        if (nettoPower >= peakThreshold) {
            this.playSequence("maxmax");
            console.warn("%c[DEBUG] ⚠️⚠️ Netto powerlevel exceeded MAXMAX threshold", "color: red;");
        } else if (nettoPower >= warningThreshold) {
            this.playSequence("max");
            console.warn("%c[DEBUG] ⚠️ Netto powerlevel exceeded MAX threshold", "color: orange;");
        } else {
            // Apply hysteresis before clearing alarm
            if ((this.alarmState === "maxmax" && nettoPower < (peakThreshold - hysteresis)) ||
                (this.alarmState === "max" && nettoPower < (warningThreshold - hysteresis))) {
                this.stop();
            }
            // Confirm idle state witch each check
            if (this.alarmState === "none") {
                console.debug("%c[DEBUG] ✅ Netto powerlevel normal", "color: green;");
            }
        }
    }

    playSequence(level) {
        if (this.alarmState !== level) {
            this.stop();
            this.alarmState = level;
        }

        // Herhaal ook al zijn we in dezelfde state
        const [frequency, count] = level === "max"
            ? [800, 3]
            : [1600, 5];

        const toneDuration = 200;
        const pauseDuration = 100;

        let timeOffset = 0;

        for (let i = 0; i < count; i++) {
            this.pendingTimeouts.push(setTimeout(() => {
                this.playTone(frequency, toneDuration);
            }, timeOffset));
            timeOffset += toneDuration + pauseDuration;
        }

        // Cleanup after sequence
        this.pendingTimeouts.push(setTimeout(() => {
            this.stop();
            this.alarmState = level; // state blijft behouden zodat check weet dat we nog in alarm zitten
        }, timeOffset));
    }

    playTone(frequency, durationMs) {
        this.stopTone(); // stop only active tone, not entire sequence

        this.oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        this.oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        this.oscillator.type = 'sine';
        this.oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime); // softer tone

        this.oscillator.start();
        setTimeout(() => this.stopTone(), durationMs);
    }

    stopTone() {
        if (this.oscillator) {
            this.oscillator.stop();
            this.oscillator.disconnect();
            this.oscillator = null;
        }
    }

    stop() {
        this.stopTone();
        this.pendingTimeouts.forEach(t => clearTimeout(t));
        this.pendingTimeouts = [];
        this.alarmState = "none";
    }
}