class AlarmChannel {
  constructor(name, alarmSound) {
    this.name = name;
    this.alarmSound = alarmSound; 
    this.triggered = false;
    this.acknowledged = false;
    this.memoryFlagSet = false;
    this.memoryFlagReset = false;
  } 
}

class AlarmUnit {
	constructor(channelConfigs, audioContext = null) {
		this.audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
		this.oscillator = null;
		this.alarmStopTimeout = null;

		// Tooninstellingen per index (0 = max, 1 = maxmax, ...)
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
		
		// Initialiseer kanalen
		this.channels = channelConfigs.map(cfg => new AlarmChannel(cfg.name, cfg.alarmSound));
		this.currentChannel = null;
	}

	acknowledgeAll() {
		for (const channel of this.channels) {
			if (channel.triggered) {
				channel.acknowledged = true;
			}
		}
		this.stop();
		console.info("🔇 All alarms acknowledged.");
	}

	check(name, setCondition, resetCondition = null) {
		const channel = this.channels.find(ch => ch.name === name);
		if (!channel) return;
	
		// Bepaal reset als positief logisch signaal (of inverse van setCondition)
		const reset = resetCondition ?? !setCondition;
	
		// Detecteer positieve flank op setCondition
		const setEdge = setCondition && !channel.memoryFlagSet;
	
		// Detecteer positieve flank op reset
		const resetEdge = reset && !channel.memoryFlagReset;
	
		if (setEdge) {
			channel.triggered = true;
			channel.acknowledged = false;
			console.warn(`⚠️ ${name.toUpperCase()} alarm triggered`);
		} else if (resetEdge) {
			channel.triggered = false;
			console.debug(`✅ ${name.toUpperCase()} alarm reset`);
		}
	
		// Update geheugenbits
		channel.memoryFlagSet = setCondition;
		channel.memoryFlagReset = reset;
	
		this._evaluateChannels();
	}

	_evaluateChannels() {
		const activeUnacknowledged = this.channels.find(
			ch => ch.triggered && !ch.acknowledged
		);

		if (activeUnacknowledged) {
			this.playSequence(activeUnacknowledged.alarmSound);
			this.currentChannel = activeUnacknowledged.name;
		} else {
			this.stop();
			this.currentChannel = null;
		}
	}

		playSequence(alarmSound) {
	  this.stop();
	
	  const config = this.alarmSoundConfigs[alarmSound];
	  if (!config) return;
	
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
	stop() {
		if (this.oscillator) {
			this.oscillator.stop();
			this.oscillator.disconnect();
			this.oscillator = null;
		}
		clearTimeout(this.alarmStopTimeout);
	}

	getActiveChannels() {
		return this.channels.filter(ch => ch.triggered && !ch.acknowledged);
	}
}