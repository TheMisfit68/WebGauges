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
			connectValues(powerIndicator, null, nettoPower, null); // Custom label and units are present so no need to pass them
			setDynamicIndicatorColor(powerIndicator, nettoPower, maxPower);
		}
		
		// When everything is in place to update the gauge, do so
		if (restIndicator && restPower) {
			connectValues(restIndicator, null, restPower, null); // Custom label and units are present so no need to pass them
			setDynamicIndicatorColor(restIndicator, nettoPower, maxPower);
		}
		
		updateGaugeStyle(nettoPower, maxPower);
		
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
		
		// Format the value to 3 decimal places and use the correct decimal and thousands separators for the system
		const formattedValue = new Intl.NumberFormat(undefined, {
			minimumFractionDigits: 3,
			maximumFractionDigits: 3,
		}).format(value);
		htmlvalue.textContent = formattedValue;
		
		// Check to see if a custom unit is provided
		const customUnit = htmlUnit.getAttribute("data-customUnit");
		if (customUnit != null) {
			htmlUnit.textContent = customUnit;
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
	
	const gaugeScale = `conic-gradient(
  from ${startOfScale}deg,
  var(--scaleColor-min-min) ${minScale}deg ${nominalMin}deg,        /* hard stop at beginning of nominal range */
  var(--scaleColor-0-25) ${nominalMin}deg,
  var(--scaleColor-25-50),
  var(--scaleColor-50-75),
  var(--scaleColor-75-100) ${nominalMax}deg,
  var(--scaleColor-max-max) ${nominalMax}deg ${maxScale}deg,        /* hard stop at the end of nominal range */
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
	gauge.style.background = `${scaleCover},${gaugeScale}`;
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
	const rootStyle = getComputedStyle(document.documentElement);
	
	// Retrieve colors from CSS variables
	const minMinColor = rootStyle.getPropertyValue('--scaleColor-min-min').trim();
	const color0to25 = rootStyle.getPropertyValue('--scaleColor-0-25').trim();
	const color25to50 = rootStyle.getPropertyValue('--scaleColor-25-50').trim();
	const color50to75 = rootStyle.getPropertyValue('--scaleColor-50-75').trim();
	const color75to100 = rootStyle.getPropertyValue('--scaleColor-75-100').trim();
	const maxMaxColor = rootStyle.getPropertyValue('--scaleColor-max-max').trim();
	
	// Determine which color to use based on the ratio
	if (ratio <= 0) {
		dynamicColor = minMinColor;
	} else if (ratio <= 0.25) {
		dynamicColor = color0to25;
	} else if (ratio <= 0.5) {
		dynamicColor = color25to50;
	} else if (ratio <= 0.75) {
		dynamicColor = color50to75;
	} else if (ratio <= 1) {
		dynamicColor = color75to100;
	} else if (ratio > 1) {
		dynamicColor = maxMaxColor;
	}
	
	// Darken the color just before applying it to the element
	dynamicDarkerColor = darkenColor(dynamicColor, 10); // Darken the color for better contrast
	
	// Apply the darkened color to the indicator text
	indicator.style.color = dynamicDarkerColor;
	
	function darkenColor(color, percentage = 20) {
		const factor = (100 - percentage) / 100; // Calculate the darkening factor
		const [r, g, b] = getRGBFromColor(color);
				
		// Apply darkening factor (make sure it’s between 0 and 1)
		const newR = Math.max(0, Math.min(255, r * factor));
		const newG = Math.max(0, Math.min(255, g * factor));
		const newB = Math.max(0, Math.min(255, b * factor));

		const darkenedColor = `rgb(${Math.round(newR)}, ${Math.round(newG)}, ${Math.round(newB)})`;
		return darkenedColor;
	}
	
	function getRGBFromColor(color) {
		
		// Create a temporary div element
		const tempElement = document.createElement("div");
		
		// Style it to avoid displaying it
		tempElement.style.position = "absolute";
		tempElement.style.visibility = "hidden";  // Make it invisible
		tempElement.style.width = "0";  // No width or height
		tempElement.style.height = "0";
		
		// Set the background color
		tempElement.style.backgroundColor = color;
		
		// Append it to the DOM
		document.body.appendChild(tempElement);
		
		// Get the computed color in RGB format
		const computedColor = window.getComputedStyle(tempElement).backgroundColor;
		
		// Remove the temporary element from the DOM
		document.body.removeChild(tempElement);
		
		// Extract RGB values from the computed color string (rgb(r, g, b))
		const rgbValues = computedColor.match(/\d+/g);  // This matches all numbers in the string
		const r = parseInt(rgbValues[0], 10);
		const g = parseInt(rgbValues[1], 10);
		const b = parseInt(rgbValues[2], 10);
		
		return [r, g, b];  // Return the RGB values as an array
	}

}

