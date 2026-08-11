const fs = require('fs');
const path = require('path');

async function run() {
  const args = process.argv.slice(2);

  const roleIndex = args.indexOf('--role');
  const targetRole = roleIndex !== -1 ? args[roleIndex + 1] : '';

  const maxIndex = args.indexOf('--max');
  const maxContacts = maxIndex !== -1 ? parseInt(args[maxIndex + 1], 10) : 0;

  const JOB_RECRUITMENT_URL = process.env.JOB_RECRUITMENT_URL || 'https://jobrecruitment.in';
  const JOB_API_KEY = process.env.JOB_API_KEY;

  if (!JOB_API_KEY) {
    console.error('Error: JOB_API_KEY must be set in .env');
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
      console.log('No candidates found. No CSV generated.');
      return;
    }

    console.log('2. Generating CSV File...');
    let csvContent = 'ID,Name,Mobile,Email,Role\n';
    validCandidates.forEach(c => {
      const cleanId = c.id || '';
      const cleanName = (c.name || '').replace(/"/g, '""');
      const cleanPhone = (c.phone || '').trim();
      const cleanEmail = (c.email || '').trim();
      const cleanRole = (c.role || '').replace(/"/g, '""');
      
      csvContent += `"${cleanId}","${cleanName}","${cleanPhone}","${cleanEmail}","${cleanRole}"\n`;
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `candidates_export_${timestamp}.csv`;
    const outputPath = path.join(__dirname, filename);

    fs.writeFileSync(outputPath, csvContent, 'utf8');
    
    console.log(`🎉 Success! Data exported to: ${outputPath}`);
    console.log(`You can now open this CSV file in Microsoft Excel to verify the data.`);

  } catch (error) {
    console.error('Script Error:', error.message);
  }
}

run();
