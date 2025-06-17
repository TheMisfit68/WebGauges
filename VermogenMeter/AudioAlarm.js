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
        this.isMuted = false;
    }

    /// Mute current alarm until next state change
    mute() {
        this.isMuted = true;
        this.stop();
        console.info("🔇 AudioAlarm muted until next status change");
    }

    /// Public check method
    check(nettoPower, warningThreshold, peakThreshold, hysteresis = 200) {
        const previousState = this.alarmState;

        if (nettoPower >= peakThreshold) {
            this.setState("maxmax");
            console.warn("%c[DEBUG] ⚠️⚠️ Netto powerlevel exceeded MAXMAX threshold", "color: red;");
        } else if (nettoPower >= warningThreshold) {
            this.setState("max");
            console.warn("%c[DEBUG] ⚠️ Netto powerlevel exceeded MAX threshold", "color: orange;");
        } else {
            // Apply hysteresis before clearing
            if ((this.alarmState === "maxmax" && nettoPower < (peakThreshold - hysteresis)) ||
                (this.alarmState === "max" && nettoPower < (warningThreshold - hysteresis))) {
                this.setState("none");
            }

            if (this.alarmState === "none") {
                console.debug("✅ Netto powerlevel normal (with hysteresis)");
            }
        }

        // Unmute automatically on state change
        if (this.isMuted && this.alarmState !== previousState) {
            this.isMuted = false;
            console.info("🔔 AudioAlarm unmuted due to status change");
        }
    }

    setState(newState) {
        if (this.alarmState === newState) return;

        this.alarmState = newState;

        if (this.isMuted) return;

        switch (newState) {
            case "max":
                this.playSequence("max");
                break;
            case "maxmax":
                this.playSequence("maxmax");
                break;
            case "none":
                this.stop();
                break;
        }
    }

    playSequence(type) {
        this.stop();

        const frequency = type === "max" ? 800 : 1600;
        const toneCount = type === "max" ? 3 : 5;
        const duration = 150;
        const pause = 100;

        let i = 0;
        const playNext = () => {
            if (i >= toneCount) return;
            this.playTone(frequency, duration);
            setTimeout(() => {
                this.stop();
                i++;
                setTimeout(playNext, pause);
            }, duration);
        };

        playNext();
    }

    playTone(frequency, durationMs) {
        this.stop(); // stop current

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

    stop() {
        if (this.oscillator) {
            this.oscillator.stop();
            this.oscillator.disconnect();
            this.oscillator = null;
        }
        clearTimeout(this.alarmStopTimeout);
    }
}