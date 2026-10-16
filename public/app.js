// State Management
let userCoords = { lat: 28.6139, lng: 77.2090 }; // Default: Delhi Secretariate
let map;
let markerGroups = {};
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let recordingTimer;
let recognition;
let clientTranscript = "";
let isOffline = false;

// Custom Icons for Leaflet Map
function createCustomIcon(colorClass) {
  return L.divIcon({
    className: `map-marker-${colorClass}`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8]
  });
}

// Format timestamp
function getTimestamp() {
  const now = new Date();
  return now.toTimeString().split(' ')[0];
}

// Log to simulated console
function logConsole(message, type = 'info') {
  const consoleLogs = document.getElementById('consoleLogs');
  if (!consoleLogs) return;

  const logLine = document.createElement('div');
  logLine.className = 'console-line';
  
  const timeSpan = document.createElement('span');
  timeSpan.className = 'console-time';
  timeSpan.textContent = `[${getTimestamp()}]`;
  
  const textSpan = document.createElement('span');
  if (type === 'success') textSpan.className = 'console-success';
  if (type === 'error') textSpan.className = 'console-error';
  if (type === 'warning') textSpan.className = 'console-warning';
  textSpan.textContent = message;
  
  logLine.appendChild(timeSpan);
  logLine.appendChild(textSpan);
  consoleLogs.appendChild(logLine);
  consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

// Initialize Leaflet Map
function initMap() {
  console.log("Initializing map...");
  
  // Center map on user default coordinates
  map = L.map('map').setView([userCoords.lat, userCoords.lng], 14);
  
  // Map tiles are provided by OpenStreetMap, not Gemini.
  // Leaflet renders the map; Gemini is used separately for AI interpretation.
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  // Initialize marker groups
  markerGroups.user = L.layerGroup().addTo(map);
  markerGroups.volunteers = L.layerGroup().addTo(map);
  markerGroups.authorities = L.layerGroup().addTo(map);
  markerGroups.shelters = L.layerGroup().addTo(map);
  markerGroups.hazards = L.layerGroup().addTo(map);
  markerGroups.checkins = L.layerGroup().addTo(map);
  markerGroups.routes = L.layerGroup().addTo(map);

  // Draw user default marker
  updateUserMarker();

  // Handle map click to update user coordinates (highly interactive simulation feature!)
  map.on('click', function(e) {
    userCoords.lat = e.latlng.lat;
    userCoords.lng = e.latlng.lng;
    updateUserMarker();
    logConsole(`USER: Relocated emergency coordinates to [${userCoords.lat.toFixed(5)}, ${userCoords.lng.toFixed(5)}]`, 'warning');
    // Re-fetch nearest shelters and volunteers relative to new location
    refreshDashboardData();
  });
}

// Update User position marker
function updateUserMarker() {
  markerGroups.user.clearLayers();
  
  const pulseIcon = L.divIcon({
    className: 'map-marker-user',
    html: '<div style="width:100%;height:100%;background:#ef4444;border-radius:50%;border:2px solid white;box-shadow:0 0 10px #ef4444;animation:pulse-recording 1.5s infinite;"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  L.marker([userCoords.lat, userCoords.lng], { icon: pulseIcon })
    .addTo(markerGroups.user)
    .bindPopup('<b>Your Current Location ( distress point )</b>')
    .openPopup();
    
  map.panTo([userCoords.lat, userCoords.lng]);
}

// Fetch and render shelters, volunteers, hazards
async function refreshDashboardData() {
  try {
    // 1. Fetch Shelters
    const sheltersRes = await fetch('/api/shelters');
    const shelters = await sheltersRes.json();
    renderShelters(shelters);

    // 2. Fetch Hazards
    const hazardsRes = await fetch('/api/hazards');
    const hazards = await hazardsRes.json();
    renderHazards(hazards);

    // 3. Fetch Volunteers
    const volunteersRes = await fetch('/api/volunteers');
    const volunteers = await volunteersRes.json();
    renderVolunteers(volunteers);
  } catch (err) {
    console.error("Error refreshing dashboard data:", err);
    logConsole("SYSTEM: Error syncing database status.", "error");
  }
}

// Render Volunteers
function renderVolunteers(volunteers) {
  markerGroups.volunteers.clearLayers();
  const volListEl = document.getElementById('volunteersList');
  const volCountEl = document.getElementById('volunteerCount');
  
  volListEl.innerHTML = '';
  let count = 0;

  // Simple haversine function in JS for client listing
  function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2-lat1) * Math.PI / 180;
    const dLon = (lon2-lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return parseFloat((R * c).toFixed(2));
  }

  // Calculate distance for each volunteer
  volunteers.forEach(v => {
    v.distance = getDistance(userCoords.lat, userCoords.lng, v.lat, v.lng);
  });

  // Sort volunteers by distance
  volunteers.sort((a,b) => a.distance - b.distance);

  volunteers.forEach(v => {
    // Show marker on map
    L.marker([v.lat, v.lng], { icon: createCustomIcon('vol') })
      .addTo(markerGroups.volunteers)
      .bindPopup(`<b>Volunteer: ${v.name}</b><br>Skills: ${v.skills.join(', ')}<br>Distance: ${v.distance} km`);

    // Add to side panel if within 2.5 km (for realistic listing)
    if (v.distance <= 2.5) {
      count++;
      const volCard = document.createElement('div');
      volCard.className = 'volunteer-card';
      volCard.innerHTML = `
        <div class="vol-info">
          <h4>${v.name}</h4>
          <p style="font-size: 0.7rem; color: var(--text-secondary);">${v.phone}</p>
          <div class="vol-skills">
            ${v.skills.map(s => `<span class="vol-skill-badge">${s}</span>`).join('')}
          </div>
        </div>
        <div class="vol-status">
          <span class="blood-badge">${v.bloodGroup}</span>
          <span class="vol-dist">${v.distance} km</span>
        </div>
      `;
      volListEl.appendChild(volCard);
    }
  });

  volCountEl.textContent = count;
}

// Render Shelters
function renderShelters(shelters) {
  markerGroups.shelters.clearLayers();
  const shelterListEl = document.getElementById('sheltersList');
  shelterListEl.innerHTML = '';

  function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2-lat1) * Math.PI / 180;
    const dLon = (lon2-lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return parseFloat((R * c).toFixed(2));
  }

  shelters.forEach(s => {
    const distance = getDistance(userCoords.lat, userCoords.lng, s.lat, s.lng);

    // Show purple marker on map
    L.marker([s.lat, s.lng], { icon: createCustomIcon('shelter') })
      .addTo(markerGroups.shelters)
      .bindPopup(`<b>Shelter: ${s.name}</b><br>Capacity: ${s.occupied}/${s.capacity}<br>Distance: ${distance} km`);

    // Add to list
    const shelterCard = document.createElement('div');
    shelterCard.className = 'volunteer-card';
    shelterCard.style.borderLeft = '3px solid #a855f7';
    shelterCard.innerHTML = `
      <div class="vol-info">
        <h4 style="color:#c084fc;">${s.name}</h4>
        <p style="font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 0.25rem;">
          Capacity: <strong>${s.occupied}/${s.capacity} occupied</strong> | Dist: ${distance} km
        </p>
        <div class="vol-skills">
          ${s.resources.map(r => `<span class="vol-skill-badge" style="background:rgba(168,85,247,0.1); border-color:rgba(168,85,247,0.3);">${r}</span>`).join('')}
        </div>
      </div>
    `;
    shelterListEl.appendChild(shelterCard);
  });
}

// Render Hazards
function renderHazards(hazards) {
  markerGroups.hazards.clearLayers();
  hazards.forEach(h => {
    const content = `<b>Hazard: ${h.type}</b><br>Severity: ${h.severity}<br>${h.description}<br><span style="font-size:0.7rem;color:grey;">By: ${h.reporter}</span>`;
    L.marker([h.lat, h.lng], { icon: createCustomIcon('hazard') })
      .addTo(markerGroups.hazards)
      .bindPopup(content);
  });
}

// Web Speech API for Client-side speech recognition fallback
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.log("Web Speech API not supported in this browser. Fallback typing enabled.");
    return;
  }
  
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-IN'; // Set locale to India to capture Indian English / Hinglish nicely

  recognition.onresult = function(event) {
    let interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        clientTranscript += event.results[i][0].transcript + ' ';
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    console.log("Speech transcription update:", clientTranscript + interimTranscript);
  };

  recognition.onerror = function(event) {
    console.warn("Speech recognition error:", event.error);
  };
}

// Media Recorder and SOS audio collection
async function toggleSOSRecording() {
  const sosBtn = document.getElementById('sosBtn');
  const sosBtnLabel = document.getElementById('sosBtnLabel');
  const sosHint = document.getElementById('sosHint');
  const visualizer = document.getElementById('visualizer');

  if (!isRecording) {
    // Start Recording
    isRecording = true;
    audioChunks = [];
    clientTranscript = "";
    sosBtn.classList.add('recording');
    sosBtnLabel.textContent = "RECORDING... TAP AGAIN TO STOP";
    sosHint.textContent = "Please speak clearly about your emergency. We are concurrently tracking your GPS coordinates.";
    visualizer.style.display = 'flex';
    logConsole("SOS: Request initiated. Geolocation captured. Audio recorder active.", "warning");

    // Fetch browser GPS real-time
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          userCoords.lat = position.coords.latitude;
          userCoords.lng = position.coords.longitude;
          updateUserMarker();
          logConsole(`GPS: Fetched live browser coordinates: [${userCoords.lat.toFixed(5)}, ${userCoords.lng.toFixed(5)}]`, "success");
        },
        (err) => {
          console.warn("Geolocation permission error, using default/simulated coords:", err.message);
          logConsole("GPS: Permission denied or unavailable. Using simulated/clicked map coordinates.", "warning");
        }
      );
    }

    // Try Speech Recognition
    if (recognition) {
      try {
        recognition.start();
      } catch (e) {
        console.error("Speech recognition already running", e);
      }
    }

    // Try Microphone Media Capture
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Prepare data payload and send to orchestrator
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        dispatchSOSPayload(audioBlob);
      };

      mediaRecorder.start();
      
      // Auto stop after 30 seconds
      recordingTimer = setTimeout(() => {
        if (isRecording) {
          logConsole("SOS: Reached maximum 30 seconds limit. Stopping recording automatically.");
          toggleSOSRecording();
        }
      }, 30000);

    } catch (err) {
      console.warn("Microphone access denied or error:", err);
      logConsole("AUDIO: Microphone access unavailable. Requesting textual fallback.", "warning");
      // If mic fails, we can prompt for custom text or use voice fallback
      // Trigger stop recording flow directly (which will run fallback text prompt)
      isRecording = false;
      sosBtn.classList.remove('recording');
      sosBtnLabel.textContent = "TAP TO RECORD";
      visualizer.style.display = 'none';
      
      // Let user input custom text
      const promptText = prompt("No microphone access. Please enter your emergency details manually (e.g. 'I am stuck in waterlogged street near Central Metro'):");
      if (promptText) {
        clientTranscript = promptText;
        dispatchSOSPayload(null);
      }
    }

  } else {
    // Stop Recording
    isRecording = false;
    clearTimeout(recordingTimer);
    sosBtn.classList.remove('recording');
    sosBtnLabel.textContent = "TAP TO RECORD";
    visualizer.style.display = 'none';
    sosHint.textContent = "Processing and routing your distress note...";
    logConsole("SOS: Dispatching audio and geolocation to Hope Seeker AI agent.");

    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {
        console.error(e);
      }
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    } else {
      dispatchSOSPayload(null);
    }
  }
}

// Send payload to backend
async function dispatchSOSPayload(audioBlob) {
  // If offline is forced, run low connectivity fallback
  if (isOffline) {
    generateOfflineFallback(clientTranscript || "Emergency SOS. Urgent assistance needed.");
    return;
  }

  logConsole("AI: Running Speech-to-Text & Intent Parsing...", "info");
  
  const formData = new FormData();
  formData.append('latitude', userCoords.lat);
  formData.append('longitude', userCoords.lng);
  formData.append('transcriptText', clientTranscript || 'No transcript available. Use the attached audio if supported; do not assume details that were not provided.');

  if (audioBlob) {
    formData.append('audio', audioBlob, 'sos-audio.webm');
  }

  try {
    const res = await fetch('/api/emergency', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    
    if (data.success) {
      const inc = data.incident;
      logConsole(`AI: Classification complete! Category: ${inc.category} | Priority: ${inc.priority}`, "success");
      logConsole(`AI: summary: "${inc.summary}"`, "success");
      logConsole(`ROUTING: Dispatching details to ${inc.routedAuthority.name} (Dist: ${inc.routedAuthority.distanceKM} km, Call: ${inc.routedAuthority.phone})`, "warning");
      logConsole(`P2P: Notified ${inc.notifiedVolunteers.length} volunteers within 2.0 km radius.`, "success");

      renderIncidentResponse(inc, data.alertTemplates);
      refreshDashboardData(); // Refresh map/lists to show volunteer assignments
    } else {
      logConsole(`ERROR: ${data.error || 'Failed to dispatch SOS'}`, "error");
    }
  } catch (err) {
    console.error("SOS Dispatch error:", err);
    logConsole("NETWORK: Failed to reach primary server. Downgrading to Offline Fallbacks.", "error");
    generateOfflineFallback(clientTranscript || "Emergency distress. Request help.");
  }
}

// Generate Offline SMS and WhatsApp fallback link targets
function generateOfflineFallback(messageText) {
  isOffline = true;
  document.getElementById('offlineToggle').checked = true;
  document.getElementById('fallbackBox').style.display = 'block';

  const phone = "112"; // Primary emergency contact in India
  const coordsStr = `Lat: ${userCoords.lat.toFixed(5)}, Lng: ${userCoords.lng.toFixed(5)}`;
  const bodyText = `SOS Emergency! Need help at ${coordsStr}. Note: ${messageText}`;
  
  // Format standard URL targets
  const smsHref = `sms:${phone}?body=${encodeURIComponent(bodyText)}`;
  const whatsappHref = `https://api.whatsapp.com/send?phone=%2B91112&text=${encodeURIComponent(bodyText)}`;

  document.getElementById('smsLink').href = smsHref;
  document.getElementById('whatsappLink').href = whatsappHref;

  logConsole("OFFLINE: Generated emergency SMS and WhatsApp templates.", "warning");
  logConsole(`OFFLINE SMS: "sms:${phone}?body=${bodyText.substring(0, 50)}..."`, "warning");
}

// Render incident dispatch on side panel
function renderIncidentResponse(inc, alertTemplates) {
  const panel = document.getElementById('activeIncidentPanel');
  markerGroups.routes.clearLayers();

  // Draw lines to volunteers
  inc.notifiedVolunteers.forEach(v => {
    // Fetch coordinates of volunteer dynamically from active db
    fetch('/api/volunteers')
      .then(r => r.json())
      .then(vols => {
        const activeVol = vols.find(vol => vol.phone === v.phone);
        if (activeVol) {
          // Draw dashed red/green helper routing line from volunteer to user
          L.polyline([[userCoords.lat, userCoords.lng], [activeVol.lat, activeVol.lng]], {
            color: '#22c55e',
            weight: 2,
            dashArray: '5, 8'
          }).addTo(markerGroups.routes);
        }
      });
  });

  // Draw routing line to assigned Emergency service
  fetch('/api/authorities')
    .then(r => r.json())
    .then(auths => {
      const auth = auths.find(a => a.name === inc.routedAuthority.name);
      if (auth) {
        L.polyline([[userCoords.lat, userCoords.lng], [auth.lat, auth.lng]], {
          color: '#3b82f6',
          weight: 4
        }).addTo(markerGroups.routes);
      }
    });

  panel.innerHTML = `
    <div class="alert-item ${inc.priority}">
      <div class="alert-meta">
        <span>Incident ID: ${inc.id}</span>
        <span class="alert-badge badge-${inc.priority}">${inc.priority}</span>
      </div>
      <div class="alert-text">${inc.category}</div>
      <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
        <strong>Transcript:</strong> "${inc.transcript}"
      </p>
      <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
        <strong>Summary:</strong> "${inc.summary}"
      </p>
      <div class="first-aid-box">
        ${inc.firstAidAdvice}
      </div>
      
      <div class="alert-routing-info">
        <div>🏥 <strong>Routed Authority:</strong> ${inc.routedAuthority.name}</div>
        <div>📞 <strong>Responders Phone:</strong> <a href="tel:${inc.routedAuthority.phone}" style="color:var(--accent-blue);">${inc.routedAuthority.phone}</a></div>
        <div>📍 <strong>Authority Distance:</strong> ${inc.routedAuthority.distanceKM} km</div>
      </div>
    </div>

    <!-- Bilingual Notification Broadcasts -->
    <div style="margin-top: 1rem; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
      <h3 style="font-size: 0.85rem; font-weight: 700; color: var(--accent-green); margin-bottom: 0.5rem;">📣 Volunteer alert drafts (not sent):</h3>
      <div style="background:rgba(255,255,255,0.02); padding:0.5rem; border-radius:0.5rem; border: 1px solid var(--border-color); font-size:0.75rem; margin-bottom:0.5rem;">
        <span style="font-weight:bold; color:var(--text-secondary);">English Alert:</span><br>
        <span style="color:#cbd5e1;">"${alertTemplates.english}"</span>
      </div>
      <div style="background:rgba(255,255,255,0.02); padding:0.5rem; border-radius:0.5rem; border: 1px solid var(--border-color); font-size:0.75rem;">
        <span style="font-weight:bold; color:var(--text-secondary);">Hindi Alert (हिंदी अलर्ट):</span><br>
        <span style="color:#cbd5e1;">"${alertTemplates.hindi}"</span>
      </div>
    </div>
  `;
}

// Handle Check-in form submit
async function handleCheckInSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('checkInName').value;
  const phone = document.getElementById('checkInPhone').value;
  const note = document.getElementById('checkInNote').value;

  logConsole(`CHECKIN: Registering check-in safety status for ${name}...`);

  try {
    const res = await fetch('/api/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, lat: userCoords.lat, lng: userCoords.lng, note })
    });
    
    const data = await res.json();
    if (data.success) {
      logConsole(`CHECKIN: Safety confirmation broadcast for ${name} complete.`, "success");
      
      // Draw green check-in marker on map
      L.marker([data.checkin.lat, data.checkin.lng], { icon: createCustomIcon('vol') })
        .addTo(markerGroups.checkins)
        .bindPopup(`<b>Safe: ${data.checkin.name}</b><br>Note: ${data.checkin.note}<br>${data.checkin.timestamp.split('T')[1].substring(0, 5)}`)
        .openPopup();

      document.getElementById('checkInForm').reset();
    }
  } catch (err) {
    logConsole("CHECKIN: Network error registering check-in status.", "error");
  }
}

// Handle volunteer simulation registration
async function handleVolRegisterSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('volName').value;
  const bloodGroup = document.getElementById('volBlood').value;
  
  // Collect checked skills
  const skills = [];
  document.querySelectorAll('input[name="skills"]:checked').forEach(c => {
    skills.push(c.value);
  });

  logConsole(`VOLUNTEER: Registering simulated first-responder ${name}...`);

  try {
    const res = await fetch('/api/volunteers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        lat: userCoords.lat + (Math.random() - 0.5) * 0.015, // distribute randomly close to user position
        lng: userCoords.lng + (Math.random() - 0.5) * 0.015,
        skills,
        bloodGroup
      })
    });

    const data = await res.json();
    if (data.success) {
      logConsole(`VOLUNTEER: Simulated volunteer ${name} registered on radar scope.`, "success");
      document.getElementById('volRegisterForm').reset();
      refreshDashboardData();
    }
  } catch (err) {
    logConsole("VOLUNTEER: Network error registering volunteer.", "error");
  }
}

// Handle custom hazard reporting
async function handleReportHazardClick() {
  const type = prompt("Enter Hazard type (e.g. Waterlogging, Road Blockage, Broken Bridge, Electric Hazard):", "Waterlogging");
  if (!type) return;
  const description = prompt("Enter brief description of hazard:", "Waterlogging about 2 feet deep, vehicles slow down.");
  if (!description) return;

  logConsole(`HAZARD: Reporting localized hazard: ${type}...`);

  try {
    const res = await fetch('/api/hazards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        lat: userCoords.lat + (Math.random() - 0.5) * 0.005,
        lng: userCoords.lng + (Math.random() - 0.5) * 0.005,
        severity: 'High',
        description,
        reporter: 'Live Simulation User'
      })
    });

    const data = await res.json();
    if (data.success) {
      logConsole(`HAZARD: New hazard marker added to Leaflet coordination grid.`, "success");
      refreshDashboardData();
    }
  } catch (err) {
    logConsole("HAZARD: Network error publishing hazard report.", "error");
  }
}

// Reset entire database
async function handleResetDBClick() {
  if (!confirm("Are you sure you want to reset simulated volunteers, active incidents, and hazard markers to default?")) return;
  
  logConsole("SYSTEM: Clearing simulation states and reloading defaults...");

  try {
    const res = await fetch('/api/reset', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      logConsole("SYSTEM: Coordinates reset. Reloaded 5 volunteers, 3 shelters, 3 hazards.", "success");
      
      // Reset user Coordinates back to secretariate
      userCoords = { lat: 28.6139, lng: 77.2090 };
      updateUserMarker();
      
      // Clear routes & checkins from map
      markerGroups.routes.clearLayers();
      markerGroups.checkins.clearLayers();
      
      // Clear active incident UI
      document.getElementById('activeIncidentPanel').innerHTML = `
        <p style="font-size: 0.8rem; color: var(--text-secondary); text-align: center; padding: 2rem 0;">
          No active distress request. Trigger an SOS or click the map to simulate emergency responses.
        </p>
      `;

      refreshDashboardData();
    }
  } catch (err) {
    logConsole("SYSTEM: Network error resetting database.", "error");
  }
}

// Setup Event Listeners and Initializers
window.addEventListener('DOMContentLoaded', () => {
  // Init Map and Speech Recognition
  initMap();
  initSpeechRecognition();
  
  // Load database status
  refreshDashboardData();

  // Draw simulated emergency centers
  fetch('/api/authorities')
    .then(r => r.json())
    .then(auths => {
      auths.forEach(a => {
        L.marker([a.lat, a.lng], { icon: createCustomIcon('auth') })
          .addTo(markerGroups.authorities)
          .bindPopup(`<b>Emergency Authority: ${a.name}</b><br>Phone: ${a.phone}<br>Handles: ${a.category}`);
      });
    });

  // Bind SOS Trigger
  document.getElementById('sosBtn').addEventListener('click', toggleSOSRecording);

  // Bind offline toggle
  const offlineToggle = document.getElementById('offlineToggle');
  const networkStatus = document.getElementById('networkStatus');
  const fallbackBox = document.getElementById('fallbackBox');

  offlineToggle.addEventListener('change', (e) => {
    isOffline = e.target.checked;
    if (isOffline) {
      networkStatus.textContent = "Network: OFFLINE";
      networkStatus.style.color = "var(--accent-orange)";
      fallbackBox.style.display = 'block';
      logConsole("OFFLINE: Offline simulation enabled. SOS triggers generate client side links.", "warning");
      generateOfflineFallback("Emergency distress. Need urgent coordination assistance.");
    } else {
      networkStatus.textContent = "Network: ONLINE";
      networkStatus.style.color = "var(--accent-green)";
      fallbackBox.style.display = 'none';
      logConsole("ONLINE: System restored. Server sync online.", "success");
    }
  });

  // Bind Tab panel toggles (Check-in vs Register Volunteer)
  const tabCheckIn = document.getElementById('tabCheckIn');
  const tabRegisterVol = document.getElementById('tabRegisterVol');
  const checkInFormPanel = document.getElementById('checkInFormPanel');
  const volunteerFormPanel = document.getElementById('volunteerFormPanel');

  tabCheckIn.addEventListener('click', () => {
    tabCheckIn.classList.add('active');
    tabRegisterVol.classList.remove('active');
    checkInFormPanel.style.display = 'block';
    volunteerFormPanel.style.display = 'none';
  });

  tabRegisterVol.addEventListener('click', () => {
    tabRegisterVol.classList.add('active');
    tabCheckIn.classList.remove('active');
    volunteerFormPanel.style.display = 'block';
    checkInFormPanel.style.display = 'none';
  });

  // Forms
  document.getElementById('checkInForm').addEventListener('submit', handleCheckInSubmit);
  document.getElementById('volRegisterForm').addEventListener('submit', handleVolRegisterSubmit);

  // Buttons
  document.getElementById('btnReportHazard').addEventListener('click', handleReportHazardClick);
  document.getElementById('btnResetDB').addEventListener('click', handleResetDBClick);
});
