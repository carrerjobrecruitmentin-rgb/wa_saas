const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:2785/api';
const API_KEY = 'owa_k1_4da9a15895d4155ec1799a1da317e3fac71af0f0119303d5a8940fc5a2be5f4c';

async function run() {
  try {
    const csvPath = path.join(__dirname, 'contacts.csv');
    const fileBuffer = fs.readFileSync(csvPath);
    const file = new File([fileBuffer], 'contacts.csv', { type: 'text/csv' });
    const form = new FormData();
    form.append('file', file);

    // 1. Upload CSV
    console.log('Uploading CSV...');
    const uploadRes = await fetch(`${API_BASE}/campaign-contacts/upload?groupName=TestGroup6`, {
      method: 'POST',
      headers: {
        'X-Api-Key': API_KEY,
      },
      body: form
    });
    
    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error('Upload failed: ' + text);
    }
    const uploadData = await uploadRes.json();
    console.log('Upload Result:', uploadData);
    
    // Find the group ID
    const groupsRes = await fetch(`${API_BASE}/campaign-contacts/groups`, {
      headers: { 'X-Api-Key': API_KEY },
    });
    const groupsData = await groupsRes.json();
    const group = groupsData.find(g => g.name === 'TestGroup6');
    if (!group) throw new Error('Group not found');
    console.log('Group ID:', group.id);

    // 2. Create Campaign
    console.log('Creating campaign...');
    const campaignPayload = {
      name: 'Test Campaign ' + Date.now(),
      groupId: group.id,
      sessionId: '9cdb3539-8346-4348-8cee-646e4a6c09d0',
      messageTemplate: 'Hello {{name}}, this is a test message from OpenWA for your role in {{custom1}} sector!',
      minDelayMs: 2000,
      maxDelayMs: 4000
    };
    
    const campRes = await fetch(`${API_BASE}/campaigns`, {
      method: 'POST',
      headers: { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(campaignPayload)
    });
    if (!campRes.ok) {
      const text = await campRes.text();
      throw new Error('Campaign create failed: ' + text);
    }
    const campData = await campRes.json();
    console.log('Campaign created:', campData);
    
    const campaignId = campData.id;
    
    // 3. Start Campaign
    console.log('Starting campaign...');
    const startRes = await fetch(`${API_BASE}/campaigns/${campaignId}/start`, {
      method: 'POST',
      headers: { 'X-Api-Key': API_KEY },
    });
    if (!startRes.ok) {
      const text = await startRes.text();
      throw new Error('Campaign start failed: ' + text);
    }
    const startData = await startRes.json();
    console.log('Campaign started:', startData);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

run();
