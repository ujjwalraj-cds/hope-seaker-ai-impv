const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Explicit homepage route so GET / serves the frontend.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Configure Multer for Audio Uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `sos-${Date.now()}-${file.originalname || 'audio.webm'}`)
});
const upload = multer({ storage });

// Haversine Distance Formula (Returns distance in km)
function getDistanceKM(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// In-Memory Database State (Pre-populated for Delhi Secretariate reference point: 28.6139, 77.2090)
const defaultState = {
  // Official Emergency Responders
  authorities: [
    { id: 'auth-1', name: 'NDRF Search & Rescue Command', category: 'Search and Rescue', phone: '011-23438017', lat: 28.6250, lng: 77.2200 },
    { id: 'auth-2', name: 'Central Emergency Medical Service (108 Ambulance)', category: 'Medical Emergency', phone: '108', lat: 28.6050, lng: 77.1950 },
    { id: 'auth-3', name: 'Delhi Fire Service Command (101)', category: 'Infrastructure/Hazard', phone: '101', lat: 28.6300, lng: 77.2150 },
    { id: 'auth-4', name: 'Indian Red Cross Relief Center', category: 'Basic Needs', phone: '011-23716441', lat: 28.6180, lng: 77.2030 },
    { id: 'auth-5', name: '112 ERSS Unified Control Room', category: 'General SOS', phone: '112', lat: 28.6120, lng: 77.2080 }
  ],
  
  // Simulated Local Volunteers
  volunteers: [
    { id: 'vol-1', name: 'Aarav Sharma', phone: '+91 98765 43210', lat: 28.6155, lng: 77.2120, skills: ['First Aid/Medical', 'Blood Donor'], bloodGroup: 'O+', status: 'active' },
    { id: 'vol-2', name: 'Priya Patel', phone: '+91 87654 32109', lat: 28.6110, lng: 77.2045, skills: ['Swimmer/Boat Owner', 'General Aid (Food/Shelter)'], bloodGroup: 'A+', status: 'active' },
    { id: 'vol-3', name: 'Rohan Gupta', phone: '+91 76543 21098', lat: 28.6190, lng: 77.2010, skills: ['First Aid/Medical', 'Blood Donor'], bloodGroup: 'B+', status: 'active' },
    { id: 'vol-4', name: 'Vikram Singh', phone: '+91 65432 10987', lat: 28.6280, lng: 77.2190, skills: ['Swimmer/Boat Owner', 'First Aid/Medical'], bloodGroup: 'AB+', status: 'active' },
    { id: 'vol-5', name: 'Ananya Nair', phone: '+91 95432 10987', lat: 28.6070, lng: 77.2180, skills: ['General Aid (Food/Shelter)', 'Blood Donor'], bloodGroup: 'O-', status: 'active' }
  ],

  // Safe Shelters
  shelters: [
    { id: 'shelter-1', name: 'NDRF Mega Relief Camp (Govt School)', lat: 28.6200, lng: 77.2250, capacity: 500, occupied: 120, resources: ['Drinking Water', 'Food packets', 'Medical Camp', 'Electricity Generator'], phone: '011-22334455' },
    { id: 'shelter-2', name: 'Sikh Gurudwara Bangla Sahib Relief Shelter', lat: 28.6263, lng: 77.2091, capacity: 1000, occupied: 350, resources: ['Langar / Warm Food', 'Drinking Water', 'Resting Area', 'First Aid'], phone: '011-23365435' },
    { id: 'shelter-3', name: 'Civil Defense Community Hall', lat: 28.6080, lng: 77.1900, capacity: 200, occupied: 45, resources: ['Food packets', 'Drinking Water', 'Temporary Beds'], phone: '011-22446688' }
  ],

  // Active Road/Infrastructure Hazards reported by citizens
  hazards: [
    { id: 'hazard-1', type: 'Waterlogging', lat: 28.6150, lng: 77.2150, severity: 'High', description: 'Waterlogged street, 3 feet deep. Passenger cars cannot pass.', reporter: 'Citizen Alert' },
    { id: 'hazard-2', type: 'Road Blockage', lat: 28.6220, lng: 77.2020, severity: 'Medium', description: 'Large Neem tree fell across the road, blocking traffic lanes.', reporter: 'Rohan Gupta' },
    { id: 'hazard-3', type: 'Live Wire', lat: 28.6100, lng: 77.2050, severity: 'High', description: 'Snapped overhead power line sparking on the wet road near market.', reporter: 'Priya Patel' }
  ],

  // Active Incidents list
  incidents: [],

  // Reassurance Check-ins ("I am Safe")
  checkins: []
};

// Clone default state into active state
let db = JSON.parse(JSON.stringify(defaultState));

// Utility to reset database
app.post('/api/reset', (req, res) => {
  db = JSON.parse(JSON.stringify(defaultState));
  console.log('Database state reset.');
  res.json({ success: true, message: 'Simulation database has been reset.' });
});

// GET endpoints to query state
app.get('/api/authorities', (req, res) => res.json(db.authorities));
app.get('/api/volunteers', (req, res) => res.json(db.volunteers));
app.get('/api/shelters', (req, res) => res.json(db.shelters));
app.get('/api/hazards', (req, res) => res.json(db.hazards));
app.get('/api/incidents', (req, res) => res.json(db.incidents));
app.get('/api/checkins', (req, res) => res.json(db.checkins));

// POST endpoint to register a new Volunteer (Simulation tool)
app.post('/api/volunteers', (req, res) => {
  const { name, phone, lat, lng, skills, bloodGroup } = req.body;
  if (!name || !lat || !lng) {
    return res.status(400).json({ error: 'Name, latitude and longitude are required.' });
  }
  const newVol = {
    id: `vol-${Date.now()}`,
    name,
    phone: phone || '+91 99999 88888',
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    skills: skills || ['General Aid (Food/Shelter)'],
    bloodGroup: bloodGroup || 'O+',
    status: 'active'
  };
  db.volunteers.push(newVol);
  console.log(`Registered volunteer: ${name}`);
  res.json({ success: true, volunteer: newVol });
});

// POST endpoint to report a Hazard (Simulation tool)
app.post('/api/hazards', (req, res) => {
  const { type, lat, lng, severity, description, reporter } = req.body;
  if (!type || !lat || !lng || !severity) {
    return res.status(400).json({ error: 'Type, lat, lng, and severity are required.' });
  }
  const newHazard = {
    id: `hazard-${Date.now()}`,
    type,
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    severity,
    description: description || '',
    reporter: reporter || 'Citizen Report'
  };
  db.hazards.push(newHazard);
  console.log(`New hazard reported: ${type} at [${lat}, ${lng}]`);
  res.json({ success: true, hazard: newHazard });
});

// POST endpoint to check in as Safe ("I am Safe" feature)
app.post('/api/check-in', (req, res) => {
  const { name, phone, lat, lng, note } = req.body;
  if (!name || !lat || !lng) {
    return res.status(400).json({ error: 'Name, latitude, and longitude are required.' });
  }
  const checkin = {
    id: `checkin-${Date.now()}`,
    name,
    phone: phone || 'N/A',
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    note: note || 'Safe and sound',
    timestamp: new Date().toISOString()
  };
  db.checkins.push(checkin);
  console.log(`Citizen check-in: ${name} is safe at [${lat}, ${lng}]`);
  res.json({ success: true, checkin });
});

// Prompt and response parsing shared by supported AI providers.
function buildAnalysisPrompt(reportText, audioIncluded) {
  return `Analyze this emergency report for Hope Seeker AI. ${audioIncluded ? 'The attached audio may be in English, Hindi, or Hinglish. Transcribe it first.' : 'The report text is supplied below.'}\n` +
    `Report: ${JSON.stringify(reportText || '')}\n` +
    `Choose category exactly from: Medical Emergency, Search and Rescue, Infrastructure/Hazard, Basic Needs. ` +
    `Choose priority exactly from: High, Medium, Low. Summarize the primary need in one short sentence. ` +
    `Return a JSON object with exactly these keys: transcript, category, priority, summary.`;
}

function parseAnalysisResponse(rawText) {
  let text = String(rawText || '').trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) text = text.slice(firstBrace, lastBrace + 1);
  const data = JSON.parse(text);
  const allowedCategories = ['Medical Emergency', 'Search and Rescue', 'Infrastructure/Hazard', 'Basic Needs'];
  const allowedPriorities = ['High', 'Medium', 'Low'];
  if (!allowedCategories.includes(data.category) || !allowedPriorities.includes(data.priority)) {
    throw new Error('AI response used an unsupported category or priority.');
  }
  return {
    transcript: typeof data.transcript === 'string' ? data.transcript.slice(0, 4000) : '',
    category: data.category,
    priority: data.priority,
    summary: typeof data.summary === 'string' && data.summary.trim() ? data.summary.trim().slice(0, 500) : 'Emergency aid requested.'
  };
}

// MAIN EMERGENCY POST ENDPOINT: /api/emergency
app.post('/api/emergency', upload.single('audio'), async (req, res) => {
  const startTime = Date.now();
  const file = req.file;
  const lat = parseFloat(req.body.latitude);
  const lng = parseFloat(req.body.longitude);
  const clientTranscript = req.body.transcriptText || '';

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'Valid latitude and longitude coordinates are required.' });
  }

  console.log(`[SOS Incident] Received request at coordinates: [${lat}, ${lng}]`);
  
  let transcript = '';
  let category = 'Basic Needs';
  let priority = 'Medium';
  let summary = 'Disaster assistance requested.';
  let analysisMode = 'Fallback System';

  // 1. Use the configured AI provider when credentials and usable text are available.
  // Supported providers: Gemini, or any OpenAI-compatible Chat Completions API
  // (including OpenRouter, OpenAI, Groq, Together, and compatible self-hosted APIs).
  const configuredProvider = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  const provider = configuredProvider || (
    process.env.GEMINI_API_KEY ? 'gemini' :
    (process.env.AI_API_KEY ? 'openai-compatible' : 'none')
  );

  try {
    let parsed = null;

    if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
      console.log('Using configured Gemini provider for incident analysis.');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      let response;

      if (file && fs.existsSync(file.path)) {
        const audioBuffer = fs.readFileSync(file.path);
        response = await ai.models.generateContent({
          model: process.env.AI_MODEL || 'gemini-2.0-flash',
          contents: [
            { inlineData: { mimeType: file.mimetype || 'audio/webm', data: audioBuffer.toString('base64') } },
            buildAnalysisPrompt(clientTranscript, true)
          ]
        });
      } else if (clientTranscript.trim()) {
        response = await ai.models.generateContent({
          model: process.env.AI_MODEL || 'gemini-2.0-flash',
          contents: buildAnalysisPrompt(clientTranscript, false)
        });
      }

      if (response && response.text) parsed = parseAnalysisResponse(response.text);
      if (parsed) analysisMode = 'Gemini AI';
    } else if (['openai-compatible', 'openrouter', 'openai', 'groq', 'together', 'custom'].includes(provider)) {
      const apiKey = process.env.AI_API_KEY;
      const model = process.env.AI_MODEL;
      if (!apiKey || !model) {
        console.warn('OpenAI-compatible provider selected, but AI_API_KEY or AI_MODEL is missing. Using local fallback.');
      } else if (clientTranscript.trim()) {
        const baseUrl = (process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
        const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
        console.log(`Using OpenAI-compatible provider (${provider}), model: ${model}`);
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
        if (process.env.OPENROUTER_SITE_URL) headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL;
        if (process.env.OPENROUTER_APP_NAME) headers['X-Title'] = process.env.OPENROUTER_APP_NAME;

        const apiResponse = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            temperature: 0.1,
            messages: [
              { role: 'system', content: 'You classify emergency reports for a disaster-response application. Return only valid JSON, no markdown.' },
              { role: 'user', content: buildAnalysisPrompt(clientTranscript, false) }
            ]
          })
        });
        if (!apiResponse.ok) {
          const detail = (await apiResponse.text()).slice(0, 500);
          throw new Error(`AI API returned HTTP ${apiResponse.status}: ${detail}`);
        }
        const payload = await apiResponse.json();
        const outputText = payload.choices?.[0]?.message?.content;
        if (typeof outputText !== 'string' || !outputText.trim()) throw new Error('AI API returned an empty response.');
        parsed = parseAnalysisResponse(outputText);
        if (parsed) analysisMode = `AI Provider (${provider})`;
      } else if (file) {
        console.warn('The configured OpenAI-compatible provider was skipped because no browser transcript was supplied. This endpoint expects text; audio transcription support varies by provider.');
      }
    } else if (provider !== 'none') {
      console.warn(`Unknown AI_PROVIDER "${provider}". Using local fallback classification.`);
    }

    if (parsed) {
      transcript = parsed.transcript || clientTranscript || 'Voice recording received; no transcript returned.';
      category = parsed.category;
      priority = parsed.priority;
      summary = parsed.summary;
    }
  } catch (err) {
    console.error('AI analysis failed; using local fallback classification:', err.message);
  }

  // 2. Local Fallback Heuristics (if API fails or key is missing)
  if (!transcript) {
    transcript = clientTranscript || 'Emergency call: Audio captured but no transcript available.';
    analysisMode = 'Fallback Heuristics (Local)';

    const textToAnalyze = transcript.toLowerCase();
    
    if (textToAnalyze.includes('hurt') || textToAnalyze.includes('pain') || textToAnalyze.includes('bleeding') || 
        textToAnalyze.includes('doctor') || textToAnalyze.includes('ambulance') || textToAnalyze.includes('hospital') ||
        textToAnalyze.includes('medical') || textToAnalyze.includes('chot') || textToAnalyze.includes('khoon') || 
        textToAnalyze.includes('daktar') || textToAnalyze.includes('saans')) {
      category = 'Medical Emergency';
      priority = 'High';
      summary = 'User reports urgent medical need or injury.';
    } else if (textToAnalyze.includes('trapped') || textToAnalyze.includes('malba') || textToAnalyze.includes('fas') || 
               textToAnalyze.includes('flood') || textToAnalyze.includes('paani') || textToAnalyze.includes('drown') ||
               textToAnalyze.includes('debris') || textToAnalyze.includes('rescue') || textToAnalyze.includes('stuck') || 
               textToAnalyze.includes('bachao')) {
      category = 'Search and Rescue';
      priority = 'High';
      summary = 'User is trapped or caught in rising waters/debris.';
    } else if (textToAnalyze.includes('fire') || textToAnalyze.includes('aag') || textToAnalyze.includes('wire') || 
               textToAnalyze.includes('bijli') || textToAnalyze.includes('current') || textToAnalyze.includes('gas') || 
               textToAnalyze.includes('short circuit') || textToAnalyze.includes('blast')) {
      category = 'Infrastructure/Hazard';
      priority = 'High';
      summary = 'User reports active infrastructure hazard (fire/live wires).';
    } else if (textToAnalyze.includes('food') || textToAnalyze.includes('khana') || textToAnalyze.includes('pani') || 
               textToAnalyze.includes('water') || textToAnalyze.includes('starving') || textToAnalyze.includes('hungry') ||
               textToAnalyze.includes('shelter') || textToAnalyze.includes('ghar') || textToAnalyze.includes('displacement')) {
      category = 'Basic Needs';
      priority = 'Medium';
      summary = 'User requires basic relief resources (food, water, or shelter).';
    } else {
      category = 'Basic Needs';
      priority = 'Medium';
      summary = 'Disaster relief required at coordinates.';
    }
  }

  // 3. Generate Immediate AI First-Aid Advice (India contextualized, English & Hindi)
  let firstAidAdvice = '';
  if (category === 'Medical Emergency') {
    firstAidAdvice = `
🚨 **IMMEDIATE FIRST-AID INSTRUCTIONS (प्राथमिक उपचार निर्देश):**
- **Bleeding (रक्तस्राव):** Apply direct firm pressure on the wound with a clean cloth. Elevate the limb. 
  *(साफ़ कपड़े से घाव पर सीधा दबाव डालें। अंग को ऊपर उठाएं।)*
- **Difficulty Breathing (सांस लेने में तकलीफ):** Sit upright. Loosen tight clothing. Keep space well-ventilated.
  *(सीधे बैठें। तंग कपड़े ढीले करें। हवा आने दें।)*
- **Fracture (हड्डी टूटना):** Keep the injured area completely still. Do not try to realign the bone.
  *(घायल हिस्से को बिल्कुल स्थिर रखें। हड्डी को सीधा करने की कोशिश न करें।)*
    `.trim();
  } else if (category === 'Search and Rescue') {
    firstAidAdvice = `
🚨 **SAFETY PROTOCOLS (सुरक्षा निर्देश):**
- **Trapped in building (इमारत में फंसे होने पर):** Stay away from windows. Protect your head. Shout or tap pipes regularly to signal search teams.
  *(खिड़कियों से दूर रहें। सिर को ढक कर रखें। राहत टीमों को संकेत देने के लिए पाइपों को ठोकें या चिल्लाएं।)*
- **Flooding/Rising Water (बाढ़ का पानी):** Move to higher ground immediately (terrace). Do NOT walk or drive through flowing water.
  *(तुरंत ऊंचे स्थान या छत पर जाएं। बहते पानी में न चलें और न ही गाड़ी चलाएं।)*
    `.trim();
  } else if (category === 'Infrastructure/Hazard') {
    firstAidAdvice = `
🚨 **HAZARD MITIGATION (खतरे से बचाव):**
- **Electrical Shock / Live Wire (बिजली का तार):** Do NOT touch wet surfaces near the wire. Stay at least 10 meters away.
  *(तार के पास गीली सतहों को न छुएं। कम से कम 10 मीटर की दूरी बनाए रखें।)*
- **Gas Leak / Fire (गैस रिसाव / आग):** Evacuate upwind immediately. Do NOT use matches, lighters, or operate electrical switches.
  *(हवा की विपरीत दिशा में तुरंत बाहर निकलें। माचिस, लाइटर या बिजली के स्विचों का उपयोग न करें।)*
    `.trim();
  } else {
    firstAidAdvice = `
💡 **RELIEF TIPS (राहत सलाह):**
- **Water Safety (पानी की सुरक्षा):** Boil or filter drinking water to avoid waterborne infections.
  *(पानी जनित संक्रमण से बचने के लिए पीने के पानी को उबालें या छान लें।)*
- **Stay Connected (जुड़े रहें):** Keep battery usage low. Keep offline SMS/WhatsApp fallbacks open.
  *(फोन की बैटरी बचाएं। ऑफलाइन एसएमएस/व्हाट्सएप संदेशों के लिए तैयार रहें।)*
    `.trim();
  }

  // 4. Smart Authority Routing (Find closest category responder)
  let routedAuthority = db.authorities.find(auth => auth.category === category);
  if (!routedAuthority) {
    // Default to unified 112 Command
    routedAuthority = db.authorities.find(auth => auth.category === 'General SOS') || db.authorities[0];
  }
  const authorityDistance = getDistanceKM(lat, lng, routedAuthority.lat, routedAuthority.lng);

  // 5. Query Localized Volunteers
  const nearbyVolunteers = [];
  db.volunteers.forEach(vol => {
    const dist = getDistanceKM(lat, lng, vol.lat, vol.lng);
    if (dist <= 2.0) { // Within 2km radius
      nearbyVolunteers.push({
        ...vol,
        distanceKM: parseFloat(dist.toFixed(2))
      });
    }
  });
  
  // Sort nearby volunteers by distance
  nearbyVolunteers.sort((a, b) => a.distanceKM - b.distanceKM);

  // 6. Generate Bilingual SMS / Web Push alerts for nearby volunteers
  const distanceStr = nearbyVolunteers.length > 0 ? `${nearbyVolunteers[0].distanceKM} km` : 'nearby';
  const alertTemplates = {
    english: `🚨 EMERGENCY NEARBY: A neighbor located within ${distanceStr} of you needs urgent assistance with: ${category}. Need: "${summary}". Skills requested: ${category === 'Medical Emergency' ? 'First Aid' : (category === 'Search and Rescue' ? 'Water Rescue / Swimmer' : 'General Assistance')}. If you are safe, navigate here: https://maps.google.com/?q=${lat},${lng}`,
    hindi: `🚨 आपातकालीन अलर्ट: आपके पास (${distanceStr}) किसी को सहायता की आवश्यकता है। श्रेणी: ${category === 'Medical Emergency' ? 'चिकित्सा आपातकाल' : (category === 'Search and Rescue' ? 'खोज और बचाव' : 'राहत सामग्री')}, विवरण: "${summary}". यदि आप सुरक्षित हैं तो मदद के लिए इस लिंक पर जाएं: https://maps.google.com/?q=${lat},${lng}`
  };

  // 7. Register Incident in database
  const incidentId = `inc-${Date.now()}`;
  const newIncident = {
    id: incidentId,
    timestamp: new Date().toISOString(),
    lat,
    lng,
    audioPath: file ? `/uploads/${file.filename}` : null,
    transcript,
    category,
    priority,
    summary,
    analysisMode,
    routedAuthority: {
      name: routedAuthority.name,
      phone: routedAuthority.phone,
      distanceKM: parseFloat(authorityDistance.toFixed(2))
    },
    notifiedVolunteers: nearbyVolunteers.map(v => ({ name: v.name, phone: v.phone, distanceKM: v.distanceKM, skills: v.skills })),
    firstAidAdvice,
    status: 'open'
  };

  db.incidents.push(newIncident);

  console.log(`[SOS Dispatch] Incident parsed successfully:
    Category: ${category} | Priority: ${priority}
    Routing: Routed to ${routedAuthority.name} (${authorityDistance.toFixed(2)} km)
    Broadcasting: Found ${nearbyVolunteers.length} volunteers within 2 km.`);

  // Respond to frontend client
  res.json({
    success: true,
    incident: newIncident,
    alertTemplates,
    processingTimeMS: Date.now() - startTime
  });
});

// Serve the app
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Hope Seeker AI disaster response server started.`);
  console.log(`Server URL: http://localhost:${PORT}`);
  console.log(`Coordinates Default secretariate reference: Delhi (28.6139, 77.2090)`);
  console.log(`====================================================`);
});
