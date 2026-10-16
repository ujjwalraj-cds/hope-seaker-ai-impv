const http = require('http');

function testEndpoint(path, label) {
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:3000' + path, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const parsed = JSON.parse(data);
        const count = Array.isArray(parsed) ? parsed.length : 'N/A';
        console.log('[' + res.statusCode + '] GET ' + path + ' => ' + label + ': ' + count + ' item(s)');
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on('error', (e) => {
      console.error('FAIL: ' + path + ' => ' + e.message);
      reject(e);
    });
  });
}

function testSOS() {
  return new Promise((resolve, reject) => {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('latitude', '28.6139');
    form.append('longitude', '77.2090');
    form.append('transcriptText', 'I am stuck in deep waterlogging near Central Metro station. Need urgent rescue help.');

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/emergency',
      method: 'POST',
      headers: form.getHeaders()
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const parsed = JSON.parse(data);
        console.log('\n[POST /api/emergency] => SOS Simulation Test');
        console.log('  Category: ' + parsed.incident.category);
        console.log('  Priority: ' + parsed.incident.priority);
        console.log('  Summary : ' + parsed.incident.summary);
        console.log('  Routed Authority: ' + parsed.incident.routedAuthority.name + ' (' + parsed.incident.routedAuthority.phone + ')');
        console.log('  Volunteers Notified: ' + parsed.incident.notifiedVolunteers.length);
        console.log('  Processing Time: ' + parsed.processingTimeMS + 'ms');
        console.log('\n  [EN] Alert: ' + parsed.alertTemplates.english.substring(0, 100) + '...');
        console.log('  [HI] Alert: ' + parsed.alertTemplates.hindi.substring(0, 100) + '...');
        resolve(parsed);
      });
    });
    req.on('error', (e) => {
      console.error('SOS FAIL: ' + e.message);
      reject(e);
    });
    form.pipe(req);
  });
}

async function runTests() {
  console.log('========================================');
  console.log('Hope Seeker AI - Backend API Health Check');
  console.log('========================================\n');

  try {
    await testEndpoint('/api/volunteers', 'Volunteers DB');
    await testEndpoint('/api/shelters', 'Shelters DB');
    await testEndpoint('/api/hazards', 'Hazards DB');
    await testEndpoint('/api/authorities', 'Authorities DB');
    await testSOS();

    console.log('\n========================================');
    console.log('All tests PASSED. Server is healthy.');
    console.log('Open http://localhost:3000 to view the app.');
    console.log('========================================');
  } catch (err) {
    console.error('\n[FAIL] Test failed: ' + err.message);
  }
}

runTests();
