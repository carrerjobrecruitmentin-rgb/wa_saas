const fs = require('fs');
const readline = require('readline');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Simple CSV line parser handling quotes
function parseCsvLine(text) {
  const re = /"(.*?)"|([^,]+)/g;
  let matches = [];
  let match;
  while ((match = re.exec(text)) !== null) {
    matches.push(match[1] !== undefined ? match[1] : match[2]);
  }
  return matches;
}

async function run() {
  const args = process.argv.slice(2);
  const tplIndex = args.indexOf('--template-file');
  if (tplIndex === -1 || !args[tplIndex + 1]) {
    console.error('Error: Please provide a template file using --template-file "path/to/template.txt"');
    process.exit(1);
  }
  const messageTemplate = fs.readFileSync(args[tplIndex + 1], 'utf8');

  const fileIndex = args.indexOf('--file');
  if (fileIndex === -1 || !args[fileIndex + 1]) {
    console.error('Error: Please provide a CSV file using --file "path/to/file.csv"');
    process.exit(1);
  }
  const csvFilePath = args[fileIndex + 1];

  const maxIndex = args.indexOf('--max');
  const maxContacts = maxIndex !== -1 ? parseInt(args[maxIndex + 1], 10) : 0;

  const skipIndex = args.indexOf('--skip');
  const skipContacts = skipIndex !== -1 ? parseInt(args[skipIndex + 1], 10) : 0;

  const OWA_API_KEY = process.env.API_KEY;
  const OWA_PORT = process.env.PORT || 2785;
  const OWA_BASE_URL = `http://localhost:${OWA_PORT}/api`;

  if (!OWA_API_KEY) {
    console.error('Error: API_KEY must be set in .env');
    process.exit(1);
  }

  if (!fs.existsSync(csvFilePath)) {
    console.error(`Error: CSV file not found at ${csvFilePath}`);
    process.exit(1);
  }

  try {
    console.log(`1. Reading candidates from CSV: ${csvFilePath}...`);
    const fileStream = fs.createReadStream(csvFilePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let headers = [];
    let validCandidates = [];
    let isFirstLine = true;

    for await (const line of rl) {
      if (!line.trim()) continue;
      const cols = parseCsvLine(line);
      
      if (isFirstLine) {
        headers = cols.map(h => h ? h.toLowerCase().trim() : '');
        isFirstLine = false;
        continue;
      }

      let c = {};
      for (let i = 0; i < cols.length; i++) {
        if (headers[i]) c[headers[i]] = cols[i];
      }

      // Detect phone and name
      let phone = c['phone'] || c['mobile'] || c['phone number'] || c['contact'];
      let name = c['name'] || c['first name'] || c['candidate name'];

      if (phone && phone.trim().length >= 10) {
        validCandidates.push({ name: name ? name.trim() : '', phone: phone.trim() });
      }

      if (maxContacts > 0 && validCandidates.length >= maxContacts) {
        console.log(`   Reached max limit of ${maxContacts} candidates.`);
        break;
      }
    }

    console.log(`Fetched ${validCandidates.length} valid candidates with phone numbers from CSV.`);

    if (validCandidates.length === 0) {
      console.log('No candidates found with phone numbers. Exiting.');
      return;
    }

    const sessionIndex = args.indexOf('--session');
    let sessionId;
    if (sessionIndex !== -1 && args[sessionIndex + 1]) {
      sessionId = args[sessionIndex + 1];
      console.log(`Forcing Session ID: ${sessionId} (Skipping CONNECTED check)`);
    } else {
      console.log('2. Auto-detecting CONNECTED WhatsApp session...');
      const sessionsRes = await fetch(`${OWA_BASE_URL}/sessions`, {
        headers: { 'X-Api-Key': OWA_API_KEY },
      });
      const sessionsData = await sessionsRes.json();
      const activeSession = sessionsData.find(s => ['CONNECTED', 'ready'].includes(s.status));
      
      if (!activeSession) {
        throw new Error('No CONNECTED WhatsApp session found in OpenWA. Please scan QR first, or force using --session <id>.');
      }
      sessionId = activeSession.id;
      console.log(`Using Session: ${sessionId}`);
    }

    console.log(`3. Starting Local Loop Campaign to ${validCandidates.length - skipContacts} contacts (Skipped ${skipContacts})...`);
    let successCount = 0;
    let failCount = 0;

    for (let i = skipContacts; i < validCandidates.length; i++) {
      const c = validCandidates[i];
      let personalizedMsg = messageTemplate.replace(/\{\{Name\}\}/gi, c.name || 'Candidate');
      
      // Clean phone number (remove +, spaces, leading 0)
      let rawPhone = c.phone.replace(/\D/g, '');
      // Ensure country code if missing (assumes India 91 for this scope)
      if (rawPhone.length === 10) rawPhone = '91' + rawPhone;
      
      const chatId = rawPhone + '@c.us';

      try {
        const sendRes = await fetch(`${OWA_BASE_URL}/sessions/${sessionId}/messages/send-text`, {
          method: 'POST',
          headers: { 'X-Api-Key': OWA_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: chatId,
            text: personalizedMsg
          })
        });
        
        if (sendRes.ok) {
          successCount++;
          console.log(`[${i+1}/${validCandidates.length}] ✅ Sent to ${c.name} (${rawPhone})`);
        } else {
          failCount++;
          const errorTxt = await sendRes.text();
          console.error(`[${i+1}/${validCandidates.length}] ❌ Failed to ${c.name} (${rawPhone}):`, errorTxt);
        }
      } catch (e) {
        failCount++;
        console.error(`[${i+1}/${validCandidates.length}] ❌ Error sending to ${rawPhone}:`, e.message);
      }

      // Hardcoded 30 seconds (30000 ms) delay
      const delayMs = 30000;
      await sleep(delayMs);
      
      // Stop after 15 messages
      if (successCount + failCount >= 15) {
          console.log('Reached hardcoded limit of 15 messages. Stopping loop.');
          break;
      }
    }

    console.log('----------------------------------------------------');
    console.log(`🎉 CSV Campaign completed! Successfully sent: ${successCount} | Failed: ${failCount}`);

  } catch (error) {
    console.error('Script Error:', error.message);
  }
}

run();
