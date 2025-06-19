class AlarmChannel {
	constructor({ name, alarmSound, color, priority }) {
		this.name = name;
		this.alarmSound = alarmSound;
		this.color = color;
		this.priority = priority;
		this.active = false;
		this.acknowledged = true;
	}
	
	get status() {
		if (this.active && !this.acknowledged) return 'active unacknowledged';
		if (this.active && this.acknowledged) return 'active acknowledged';
		if (!this.active && !this.acknowledged) return 'inactive unacknowledged';
		return 'inactive';
	}
}

class ToneGenerator {
	constructor(audioContext = null) {
		this.audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
		this.oscillator = null;
		this.alarmStopTimeout = null;
	}

	playTone(frequency, durationMs, type = 'sine', vibrato = false) {
		this.stop();

		this.oscillator = this.audioContext.createOscillator();
		const gainNode = this.audioContext.createGain();

		this.oscillator.connect(gainNode);
		gainNode.connect(this.audioContext.destination);

		this.oscillator.type = type;
		this.oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

		if (vibrato) {
			const vibratoOsc = this.audioContext.createOscillator();
			const vibratoGain = this.audioContext.createGain();

			vibratoOsc.frequency.setValueAtTime(10, this.audioContext.currentTime);
			vibratoGain.gain.setValueAtTime(20, this.audioContext.currentTime);

			vibratoOsc.connect(vibratoGain);
			vibratoGain.connect(this.oscillator.frequency);

			vibratoOsc.start();
			setTimeout(() => vibratoOsc.stop(), durationMs);
		}

		gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime);

		this.oscillator.start();
		this.alarmStopTimeout = setTimeout(() => this.stop(), durationMs);
	}

	playSequence(config) {
		this.stop();

		let i = 0;

		const playNext = () => {
			if (i >= config.steps.length) return;

			const step = config.steps[i];
			this.playTone(step.freq, step.duration, step.type, step.vibrato);

			setTimeout(() => {
				this.stop();
				i++;
				setTimeout(playNext, 100);
			}, step.duration);
		};

		playNext();
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

class AlarmUnit {
	constructor(channelConfigs, audioContext = null) {
		this.toneGenerator = new ToneGenerator(audioContext);

		this.alarmSoundConfigs = {
			"maxSound": {
				steps: [
					{ freq: 500, type: 'sine', duration: 200 },
					{ freq: 600, type: 'sine', duration: 200 },
					{ freq: 700, type: 'sine', duration: 200 },
				]
			},
			"maxmaxSound": {
				steps: [
					{ freq: 800, type: 'square', duration: 100, vibrato: true },
					{ freq: 1800, type: 'square', duration: 100, vibrato: true },
					{ freq: 800, type: 'square', duration: 100, vibrato: true },
					{ freq: 1800, type: 'square', duration: 100, vibrato: true },
					{ freq: 800, type: 'square', duration: 100, vibrato: true },
					{ freq: 1800, type: 'square', duration: 100, vibrato: true },
				]
			},
			"extraSound": {
				steps: [
					{ freq: 1000, type: 'triangle', duration: 100 },
					{ freq: 1100, type: 'triangle', duration: 100 },
					{ freq: 1200, type: 'triangle', duration: 100 },
					{ freq: 1100, type: 'triangle', duration: 100 },
					{ freq: 1000, type: 'triangle', duration: 100 },
				]
			}
		};

		this.channels = channelConfigs.map(cfg => new AlarmChannel(cfg));
		this.currentChannel = null;
	}

	acknowledgeAll({ onlyActive = false } = {}) {
		for (const channel of this.channels) {
			if (!channel.acknowledged && (!onlyActive || channel.active)) {
				channel.acknowledged = true;
			}
		}
		this.toneGenerator.stop();
		console.info("🔇 All alarms acknowledged.");
	}

	check(name, setCondition, resetCondition = null) {
		const channel = this.channels.find(ch => ch.name === name);
		if (!channel) return;

		const reset = resetCondition ?? !setCondition;
		const setEdge = setCondition && !channel.memoryFlagSet;
		const resetEdge = reset && !channel.memoryFlagReset;

		if (setEdge) {
			channel.active = true;
			channel.acknowledged = false;
			console.warn(`⚠️ [${channel.name}] alarm active`);
		} else if (resetEdge) {
			channel.active = false;
			console.debug(`✅ [${channel.name}] alarm reset`);
		}

		channel.memoryFlagSet = setCondition;
		channel.memoryFlagReset = reset;

		this._evaluateChannels();
	}

	get sortedChannels() {
	  return [...this.channels].sort((a, b) => a.priority - b.priority);
	}
	
	get activeChannels() {
	  return this.sortedChannels.filter(ch => ch.active);
	}
	
	get pendingChannels() {
	  return this.sortedChannels.filter(ch => !ch.acknowledged);
	}
	
	get activeUnacknowledgedChannels() {
	  return this.activeChannels.filter(ch => !ch.acknowledged);
	}
	
	getHighestPriorityActiveAlarm() {
	  return this.activeUnacknowledgedChannels[0] || null;
	}

	_evaluateChannels() {
		const topChannel = this.getHighestPriorityActiveAlarm();
		if (topChannel) {
			const config = this.alarmSoundConfigs[topChannel.alarmSound];
			if (config) {
				this.toneGenerator.playSequence(config);
			}
			this.currentChannel = topChannel.name;
		} else {
			this.toneGenerator.stop();
			this.currentChannel = null;
		}
	}
	
	logStatus() {
	  console.group("📢 AlarmUnit Status");
	  this.sortedChannels.forEach(channel => {
	    console.log(`${channel.name}: ${channel.status}`);
	  });
	  console.groupEnd();
	}
	
}