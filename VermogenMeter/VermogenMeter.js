// main.js
//
// A blend of human creativity by TheMisfit68 and
// AI assistance from ChatGPT.
// Crafting the future, one line of JS at a time.
// Copyright © 2023 Jan Verrept. All rights reserved.

let baseURL = "";
let userName = "";
let password = "";

window.alarmUnit = new AlarmUnit([
	{ name: "MAXMAX", alarmSound: "maxmaxSound", color: "red", priority: 1 },
	{ name: "MAX",    alarmSound: "maxSound",    color: "orange", priority: 2 },
]);

window.onload = async function () {
	await loadSettings();
	updateGaugeValues();
	setInterval(updateGaugeValues, 5000);

	const acknowledgeButton = document.getElementById("acknowledge-button");
	acknowledgeButton.addEventListener("click", () => {
		window.alarmUnit.acknowledgeAll();
		updateAcknowledgeButton();
	});
};

const ENDPOINTS = {
	"powerDelivered": "power_delivered",
	"powerReturned": "power_returned",
	"secondary-indicator": "highest_peak_pwr",
};

const zeroIndicator = document.getElementById("zero-indicator");
const powerIndicator = document.getElementById("primary-indicator");
const maxPowerIndicator = document.getElementById("secondary-indicator");
const restIndicator = document.getElementById("rest-indicator");
let indicatorValues = [0];

async function updateGaugeValues() {
	try {
		const data = await fetchValues();

		let powerDelivered = null;
		let powerReturned = null;
		let nettoPower = null;
		let maxPower = null;
		let restPower = null;

		Object.entries(data).forEach(([endpointTag, endpointData]) => {
			const indicatorToConnect = document.getElementById(endpointTag);
			const indicatorData = composeIndicatorData(endpointTag, endpointData);

			switch (endpointTag) {
				case "powerDelivered":
					powerDelivered = indicatorData.value;
					break;
				case "powerReturned":
					powerReturned = indicatorData.value;
					nettoPower = powerDelivered - powerReturned;
					indicatorValues.push(nettoPower);
					break;
				case "secondary-indicator":
					maxPower = indicatorData.value;
					if (maxPower <= 2.5) {
						maxPower = 2.5;
						maxPowerIndicator.style.color = "green";
					} else {
						maxPowerIndicator.style.color = "red";
					}
					restPower = Math.max(0, maxPower - nettoPower);
					connectDataset(indicatorToConnect, indicatorData);
					indicatorValues.push(maxPower, restPower);
					break;
				default:
					console.warn("⚠️ No handler for endpoint: " + endpointTag);
			}
		});

		if (powerIndicator && nettoPower != null) {
			connectValues(powerIndicator, null, nettoPower, null);
			setDynamicIndicatorColor(powerIndicator, nettoPower, maxPower);
		}

		if (restIndicator && restPower != null) {
			connectValues(restIndicator, null, restPower, null);
			setDynamicIndicatorColor(restIndicator, nettoPower, maxPower);
		}

		updateGaugeStyle(nettoPower, maxPower);

		if (nettoPower !== null && maxPower !== null) {
			const alarmThresholdMax = 0.75 * maxPower;
			const alarmThresholdMaxMax = maxPower;
			const hysteresis = 0.2;
			window.alarmUnit.check("MAX", nettoPower >= alarmThresholdMax, nettoPower <= alarmThresholdMax - hysteresis);
			window.alarmUnit.check("MAXMAX", nettoPower >= alarmThresholdMaxMax, nettoPower <= alarmThresholdMaxMax - hysteresis);
		}

		updateAcknowledgeButton();
		window.alarmUnit.logStatus();

	} catch (error) {
		console.error("❌ Error in updateGaugeValues:", error);
	}
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

async function loadSettings() {
	try {
		const response = await fetch("/DSMRsettings.json");
		if (!response.ok) throw new Error("❌ Failed to load config");

		const settings = await response.json();
		const hostName = settings.Hostname;
		baseURL = "http://" + hostName + ".local/api/v2/sm/fields/".toLowerCase();
		const credentials = settings["basic-auth"];
		userName = credentials.user;
		password = credentials.pass;

		console.debug("[DEBUG] ⚙️✅ Settings loaded");
	} catch (error) {
		console.error("❌ Error loading config:", error);
	}
}

async function fetchValues() {
	const headers = new Headers();
	headers.set("Authorization", "Basic " + btoa(userName + ":" + password));
	headers.set("Content-Type", "application/json");

	const requests = Object.entries(ENDPOINTS).map(async ([endpointTag, endpoint]) => {
		const cleanURL = baseURL.replace(/\/$/, "") + "/" + endpoint.replace(/^\//, "");
		try {
			const response = await fetch(cleanURL, { method: "GET", headers });
			if (!response.ok) throw new Error("❌ Error " + response.status + ": " + response.statusText);
			const jsonData = await response.json();
			return [endpointTag, jsonData];
		} catch (error) {
			console.error("❌ Fetch error for " + endpointTag + ":", error);
			return [endpointTag, null];
		}
	});

	return Object.fromEntries(await Promise.all(requests));
}

function composeIndicatorData(endpointTag, endpointData) {
	const valuesKey = Object.keys(endpointData).find(key => key !== "timestamp");
	const values = endpointData[valuesKey];
	return { quantity: endpointTag, ...values };
}

function connectDataset(indicator, data) {
	connectValues(indicator, data.quantity, data.value, data.unit);
}

function connectValues(indicator, label, value, unit) {
	if (!indicator) return console.warn("⚠️ [connectValues] Indicator not found");

	const htmlLabel = indicator.querySelector(".label");
	const htmlValue = indicator.querySelector(".value");
	const htmlUnit = indicator.querySelector(".unit");

	htmlLabel.textContent = htmlLabel.getAttribute("data-customLabel") || label;
	htmlValue.textContent = new Intl.NumberFormat(undefined, {
		minimumFractionDigits: 3,
		maximumFractionDigits: 3,
	}).format(value);
	htmlUnit.textContent = htmlUnit.getAttribute("data-customUnit") || unit;
}

function updateGaugeStyle(nettoPower, maxPower) {
	const gauge = document.querySelector(".gauge");
	const start = -135;
	const min = 0, nominalMin = 45, nominalMax = 225, max = 270;
	const percentage = nettoPower / maxPower;
	let angle = nominalMin + percentage * (nominalMax - nominalMin);
	angle = Math.max(min, Math.min(angle, max));

	const scale = `conic-gradient(
    from ${start}deg,
    var(--scaleColor-min-min) ${min}deg ${nominalMin}deg,
    var(--scaleColor-0-25) ${nominalMin}deg,
    var(--scaleColor-25-50),
    var(--scaleColor-50-75),
    var(--scaleColor-75-100) ${nominalMax}deg,
    var(--scaleColor-max-max) ${nominalMax}deg ${max}deg,
    transparent ${max}deg 360deg
  )`;

	const cover = `conic-gradient(from ${start}deg, 
    rgba(255,255,255,0.85) ${start}deg ${nominalMin}deg,
    transparent ${nominalMin}deg ${angle}deg,
    rgba(255,255,255,0.85) ${angle}deg ${max}deg,
    transparent ${max}deg 360deg)`;

	gauge.style.background = `${cover}, ${scale}`;
}

function setDynamicIndicatorColor(indicator, nettoPower, maxPower) {
	const ratio = nettoPower / maxPower;
	const root = getComputedStyle(document.documentElement);

	const ranges = [
		{ limit: 0.0, color: '--scaleColor-min-min' },
		{ limit: 0.25, color: '--scaleColor-0-25' },
		{ limit: 0.5, color: '--scaleColor-25-50' },
		{ limit: 0.75, color: '--scaleColor-50-75' },
		{ limit: 1.0, color: '--scaleColor-75-100' },
		{ limit: Infinity, color: '--scaleColor-max-max' }
	];

	const match = ranges.find(r => ratio <= r.limit);
	let dynamicColor = root.getPropertyValue(match.color).trim();
	indicator.style.color = darkenColor(dynamicColor, 10);

	function darkenColor(color, percent) {
		const [r, g, b] = getRGBFromColor(color);
		const f = (100 - percent) / 100;
		return `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;
	}

	function getRGBFromColor(color) {
		const temp = document.createElement("div");
		temp.style.backgroundColor = color;
		document.body.appendChild(temp);
		const rgb = getComputedStyle(temp).backgroundColor.match(/\d+/g).map(Number);
		document.body.removeChild(temp);
		return rgb;
	}
}

function updateAcknowledgeButton() {
	const button = document.getElementById("acknowledge-button");
	const topAlarm = window.alarmUnit.getHighestPriorityActiveAlarm();

	if (topAlarm) {
		button.style.display = "inline-block";
		button.className = ""; // reset alle klassen
		button.classList.add(topAlarm.color);
	} else {
		button.style.display = "none";
		button.className = "";
	}
}
