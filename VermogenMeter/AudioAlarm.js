//
// AudioAlarm.js
//
// A blend of human creativity by TheMisfit68 and
// AI assistance from ChatGPT.
// Crafting the future, one line of JavaScript at a time.
// Copyright © 2023 Jan Verrept. All rights reserved.
//

class AudioAlarm {

    constructor(audioContext = null) {
        this.audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
        this.oscillator = null;
        this.alarmState = "none"; // "none", "max", "maxmax"
    }

    /// Check method with thresholds passed as arguments
    check(currentPowerWatt, warningThreshold, peakThreshold) {
        if (currentPowerWatt >= peakThreshold) {
            if (this.alarmState !== "maxmax") this.playMAXMAX();
        } else if (currentPowerWatt >= warningThreshold) {
            if (this.alarmState !== "max") this.playMAX();
        } else {
            if (this.alarmState !== "none") this.stop();
        }
    }

    playTone(frequency, durationMs) {
        this.stop(); // Stop any current tone

        this.oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        this.oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        this.oscillator.type = 'sine';
        this.oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime); // softer tone

        this.oscillator.start();
        this.alarmStopTimeout = setTimeout(() => this.stop(), durationMs);
    }

    playMAX() {
        this.alarmState = "max";
        this.playTone(800, 200); // short beep
    }

    playMAXMAX() {
        this.alarmState = "maxmax";
        this.playTone(1600, 1000); // long tone
    }

    stop() {
        if (this.oscillator) {
            this.oscillator.stop();
            this.oscillator.disconnect();
            this.oscillator = null;
        }
        clearTimeout(this.alarmStopTimeout);
        this.alarmState = "none";
    }
}