let baseURL = "";
let userName = "";
let password = "";
window.onload = async function() {
	await loadSettings();  // Wait for the settings to load first
	updateGaugeValues();         // Then call updateGaugeValues after settings are loaded
	setInterval(updateGaugeValues, 5000); // Set the interval to call every 5 seconds
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
		const data = await fetchValues(); // Get all the JSON data
		
		let indicatorToConnect;
		let indicatorData;
		let htmlLabel;
		let htmlValue;
		let htmlUnit;
		
		let powerDelivered = null;
		let powerReturned = null;
		let nettoPower = null;
		let maxPower = null;
		let restPower = null;
		
		// Loop through the tagged data store the values
		// if the tag matches some indicator, automatically attach the data to that indicator
		Object.entries(data).forEach(([endpointTag, endpointData]) => {
			
			indicatorToConnect = document.getElementById(endpointTag);
			indicatorData = composeIndicatorData(endpointTag, endpointData);
			
			switch (endpointTag) {
				case "powerDelivered":
					powerDelivered = composeIndicatorData("powerDelivered", endpointData).value;
					break;
					
				case "powerReturned":
					powerReturned = composeIndicatorData("powerReturned", endpointData).value;
					nettoPower = powerDelivered - powerReturned;
					indicatorValues.push(nettoPower);
					break;
					
				case "secondary-indicator":
					maxPower = indicatorData.value;
					if (maxPower <= 2.5) {
						maxPower = 2.5;
					}
					restPower = maxPower-nettoPower;
					if (restPower < 0) {
						restPower = 0;
					}
					connectDataset(indicatorToConnect, indicatorData);
					indicatorValues.push(maxPower);
					indicatorValues.push(restPower);
					break;
					
				default:
					console.warn("⚠️ No handler for endpoint: " + endpointTag);
					break;
			}
		});
		
		// Update indicators that use calculated values
		if (powerIndicator && nettoPower) {
			
			htmlLabel = powerIndicator.querySelector(".label");
			htmlvalue = powerIndicator.querySelector(".value");
			htmlUnit = powerIndicator.querySelector(".unit");
			
			htmlLabel.textContent = htmlLabel.getAttribute("data-customLabel");
			htmlvalue.textContent = nettoPower.toFixed(3);      // Update value
			htmlUnit.textContent = htmlUnit.getAttribute("data-customUnit");
		}
		
		// When everything is in place to update the gauge, do so
		if (restIndicator && restPower) {
			
			htmlLabel = restIndicator.querySelector(".label");
			htmlvalue = restIndicator.querySelector(".value");
			htmlUnit = restIndicator.querySelector(".unit");
			
			htmlLabel.textContent = htmlLabel.getAttribute("data-customLabel");
			htmlvalue.textContent = restPower.toFixed(3);      // Update value
			htmlUnit.textContent = htmlUnit.getAttribute("data-customUnit");
		}
		
		// Update gauge scale based on both indicatorValues
		updateGaugeStyle(nettoPower, maxPower);
		// Set dynamic color for the indicators
		setDynamicIndicatorColor(powerIndicator, nettoPower, maxPower);
		setDynamicIndicatorColor(restIndicator, nettoPower, maxPower);
		
	} catch (error) {
		console.error("❌ Error in updateGaugeValues:", error);
	}
}


function connectDataset(indicatorToConnect, indicatorData) {
	connectValues(indicatorToConnect, indicatorData.quantity, indicatorData.value, indicatorData.unit);
}

function connectValues(indicatorToConnect, label, value, unit) {
	
	if (indicatorToConnect != null) {
		
		// Select child elements within this indicator
		const htmlLabel = indicatorToConnect.querySelector(".label");
		const htmlvalue = indicatorToConnect.querySelector(".value");
		const htmlUnit = indicatorToConnect.querySelector(".unit");
		
		// Update text content of the HTML elements
		// Check to see if a custom label is provided
		const customLabel = htmlLabel.getAttribute("data-customLabel");
		if (customLabel != null) {  // Fix: added parentheses around condition
			htmlLabel.textContent = customLabel;
		} else {
			htmlLabel.textContent = label;
		}
		
		htmlvalue.textContent = value.toFixed(3);
		
		// Check to see if a custom unit is provided
		const customUnit = htmlUnit.getAttribute("data-customUnit");
		if (customUnit != null) {
			htmUnit.textContent = customUnit;
		} else {
			htmlUnit.textContent = unit;
		}
	}else {
		console.warn("⚠️ [connectValues] Indicator not found");
	}
}

function updateGaugeStyle(nettoPower, maxPower) {
	
	// The angles used to define the gradient for the scale
	// are based on a system where zero degrees is midscale or 12 o'clock
	// Gradients that start with a 'from' parameter will start at the specified angle and
	// gradientpoints are defined relative from that angle
	const gauge = document.querySelector(".gauge");
	
	// Define abosolute angle that the scale will start at
	const startOfScale = -135;
	
	// Define relative angles within that scale
	const minScale = 0;
	const nominalMin = 45;
	const nominalMax = 225;
	const maxScale = 270;
	
	// NettoPower expressed as an angle within the scale
	const percentage = (nettoPower / maxPower);
	const nominalRange = (nominalMax - nominalMin);
	let currentAngle = nominalMin+(percentage * nominalRange);
	// Always limit the angle within the defined ranges
	if (currentAngle <= minScale) {
		currentAngle = minScale;
	}
	if (currentAngle >= maxScale) {
		currentAngle = maxScale;
	}
	
	const gaugeCenter = `radial-gradient(var(--background) 0 var(--cutout), transparent var(--cutout) 100%)`;
	const gaugeScale = `conic-gradient(from ${startOfScale}deg, 
green ${minScale}deg ${nominalMin}deg, 
yellow,
orange, 
red ${nominalMax}deg ${maxScale}deg, 
transparent ${maxScale}deg 360deg
)`;
	let scaleCover
	if (nettoPower >= 0) {
		scaleCover = `conic-gradient(from ${startOfScale}deg, 
rgba(255, 255, 255, 0.85) ${startOfScale}deg ${nominalMin}deg, 
transparent ${nominalMin}deg ${currentAngle}deg,
rgba(255, 255, 255, 0.85) ${currentAngle}deg  ${maxScale}deg,
transparent ${maxScale}deg 360deg 
)`;
	} else {
		scaleCover = `conic-gradient(from ${startOfScale}deg, 
rgba(255, 255, 255, 0.85) ${startOfScale}deg  ${currentAngle}deg,
transparent ${currentAngle}deg ${nominalMin}deg,
rgba(255, 255, 255, 0.85) ${nominalMin}deg ${maxScale}deg,
transparent ${maxScale}deg 360deg 
)`;
	}
	
	// Apply the gauge components as CSS background
	gauge.style.background = `${scaleCover},${gaugeCenter},${gaugeScale}`;
}

// Subroutines
async function loadSettings() {
	try {
		const response = await fetch("/DSMRsettings.json");  // Fetch the config file from the ESP32
		if (!response.ok) throw new Error("❌ Failed to load config");
		
		const settings = await response.json();  // Parse JSON
		
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
		const cleanbaseURL = baseURL.replace(/\/$/, ""); // Ensure baseURL does not end with '/'
		const cleanEndpoint = endpoint.replace(/^\//, ""); // Ensure endpoint does not start with '/'
		
		const url = cleanbaseURL + "/" + cleanEndpoint;
		try {
			console.debug("%c[DEBUG] ⏬️ Fetching: " + url, "color: grey;");
			const response = await fetch(url, { method: "GET", headers });
			
			if (!response.ok) {
				throw new Error("❌ Error " + response.status + ": " + response.statusText);
			}
			const jsonData = await response.json();
			console.debug("[DEBUG] Received JSON data:", jsonData);
			console.debug("[DEBUG] 🟢⇣ Response: ", jsonData);
			return [endpointTag, jsonData]; // Return as a key-value pair
			
		} catch (error) {
			console.error("❌ Fetch error for " + endpointTag + ":", error);
			return [endpointTag, null]; // Keep consistent structure
		}
	});
	
	// Await all requests and return as an object
	return Object.fromEntries(await Promise.all(requests));
}

function composeIndicatorData(endpointTag, endpointData) {
	const valuesKey = Object.keys(endpointData).find(key => key !== "timestamp"); // Find a key other than "timestamp"
	const values = endpointData[valuesKey]; // Get the values associated with that key
	const indicatorData = { quantity: endpointTag, ...values }; // Merge tag and values
	return indicatorData;
}

function setDynamicIndicatorColor(indicator, nettoPower, maxPower) {
	let dynamicColor = "gray";
	
	const ratio = nettoPower / maxPower;
	if (ratio <= 0.25) {
		dynamicColor = "green";
	} else if (ratio <= 0.5) {
		dynamicColor = "yellow";
	} else if (ratio <= 0.75) {
		dynamicColor = "rgb(255, 147, 0)"; // Dark orange
	} else {
		dynamicColor = "red";
	}
	
	indicator.style.color = dynamicColor; // Apply color to the element
}
