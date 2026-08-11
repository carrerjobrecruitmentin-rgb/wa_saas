const fs = require('fs');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const args = process.argv.slice(2);
  const msgIndex = args.indexOf('--message');
  if (msgIndex === -1 || !args[msgIndex + 1]) {
    console.error('Error: Please provide a message template using --message "Your message {{Name}}"');
    process.exit(1);
  }
  const messageTemplate = args[msgIndex + 1];

  const roleIndex = args.indexOf('--role');
  const targetRole = roleIndex !== -1 ? args[roleIndex + 1] : '';

  const maxIndex = args.indexOf('--max');
  const maxContacts = maxIndex !== -1 ? parseInt(args[maxIndex + 1], 10) : 0;

  const skipIndex = args.indexOf('--skip');
  const skipContacts = skipIndex !== -1 ? parseInt(args[skipIndex + 1], 10) : 0;

  const JOB_RECRUITMENT_URL = process.env.JOB_RECRUITMENT_URL || 'https://jobrecruitment.in';
  const JOB_API_KEY = process.env.JOB_API_KEY;
  const OWA_API_KEY = process.env.API_KEY;
  const OWA_PORT = process.env.PORT || 2785;
  const OWA_BASE_URL = `http://localhost:${OWA_PORT}/api`;

  if (!JOB_API_KEY || !OWA_API_KEY) {
    console.error('Error: JOB_API_KEY and API_KEY must be set in .env');
    process.exit(1);
  }

  try {
    console.log(`1. Fetching candidates from JobRecruitment API (Paginated)...`);
    if (targetRole) console.log(`   - Filtering by Role: ${targetRole}`);
    if (maxContacts) console.log(`   - Limiting to max contacts: ${maxContacts}`);

    let allCandidates = [];
    let lastId = 0;
    let hasMore = true;

    while (hasMore) {
      let fetchUrl = `${JOB_RECRUITMENT_URL}/backend/api/worker-api.php?action=get_all_campaign_cands&limit=1000&last_id=${lastId}`;
      if (targetRole) {
        fetchUrl += `&role=${encodeURIComponent(targetRole)}`;
      }

      const res = await fetch(fetchUrl, {
        headers: {
          'Authorization': `Bearer ${JOB_API_KEY}`,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) throw new Error(`JobRecruitment API error: ${res.statusText}`);
      
      const data = await res.json();
      if (!data.success) throw new Error(`API returned failure: ${JSON.stringify(data)}`);

      // Filter and append valid phone numbers
      const validChunk = data.cands.filter(c => c.phone && c.phone.trim().length >= 10);
      allCandidates = allCandidates.concat(validChunk);
      
      if (maxContacts > 0 && allCandidates.length >= maxContacts) {
        allCandidates = allCandidates.slice(0, maxContacts);
        console.log(`   Reached max limit of ${maxContacts} candidates. Stopping fetch.`);
        hasMore = false; // Stop pagination early
      } else if (data.pagination && data.pagination.has_more) {
        lastId = data.pagination.last_id;
      } else {
        hasMore = false;
      }
    }

    const validCandidates = allCandidates;
    console.log(`Fetched ${validCandidates.length} valid candidates with phone numbers.`);

    if (validCandidates.length === 0) {
      console.log('No candidates found with phone numbers. Exiting.');
      return;
    }

    console.log('2. Generating and Saving CSV File...');
    let csvContent = 'Name,Mobile,Email\n';
    validCandidates.forEach(c => {
      const cleanName = (c.name || '').replace(/"/g, '""');
      const cleanPhone = (c.phone || '').trim();
      const cleanEmail = (c.email || '').trim();
      csvContent += `"${cleanName}","${cleanPhone}","${cleanEmail}"\n`;
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const localFilename = `campaign_dispatched_${timestamp}.csv`;
    fs.writeFileSync(require('path').join(__dirname, localFilename), csvContent, 'utf8');
    console.log(`   -> Saved backup sheet locally: ${localFilename}`);

    console.log('3. Auto-detecting CONNECTED WhatsApp session...');
    const sessionsRes = await fetch(`${OWA_BASE_URL}/sessions`, {
      headers: { 'X-Api-Key': OWA_API_KEY },
    });
    const sessionsData = await sessionsRes.json();
    const activeSession = sessionsData.find(s => ['CONNECTED', 'ready'].includes(s.status));
    
    if (!activeSession) {
      throw new Error('No CONNECTED WhatsApp session found in OpenWA. Please scan QR first.');
    }
    console.log(`Using Session: ${activeSession.id}`);

    console.log(`4. Starting Local Loop Campaign to ${validCandidates.length} contacts...`);
    let successCount = 0;
    let failCount = 0;

    for (let i = skipContacts; i < validCandidates.length; i++) {
      const c = validCandidates[i];
      let personalizedMsg = messageTemplate.replace(/\{\{Name\}\}/gi, c.name || 'Accountant');
      
      // Clean phone number (remove +, spaces, leading 0)
      let rawPhone = c.phone.replace(/\D/g, '');
      // Ensure country code if missing (assumes India 91 for this scope)
      if (rawPhone.length === 10) rawPhone = '91' + rawPhone;
      
      const chatId = rawPhone + '@c.us';

      try {
        const sendRes = await fetch(`${OWA_BASE_URL}/sessions/${activeSession.id}/messages/send-text`, {
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

      // Add human emulation delay (2.5 - 4.5 seconds)
      const delayMs = Math.floor(Math.random() * 2000) + 2500;
      await sleep(delayMs);
    }

    console.log('----------------------------------------------------');
    console.log(`🎉 Campaign completed! Successfully sent: ${successCount} | Failed: ${failCount}`);

  } catch (error) {
    console.error('Script Error:', error.message);
  }
}

run();
