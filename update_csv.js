const fs = require('fs');

const path = 'C:\\hk\\DUMP\\wa_saas\\candidates_export_2026-08-11T05-52-50-154Z.csv';
const csv = fs.readFileSync(path, 'utf8');
const lines = csv.split('\n');
const newLines = [];
let validCount = 0;

for(let i = 0; i < lines.length; i++) {
  if(!lines[i].trim()) continue;
  if(i === 0) {
    if (!lines[i].includes('Status')) {
        newLines.push(lines[i].trim() + ',"Status"');
    } else {
        newLines.push(lines[i].trim());
    }
    continue;
  }
  
  // Use regex to split avoiding commas inside quotes
  const re = /"(.*?)"|([^,]+)/g;
  let matches = [];
  let match;
  while ((match = re.exec(lines[i])) !== null) {
    matches.push(match[1] !== undefined ? match[1] : match[2]);
  }
  
  // Assuming Phone is index 1 or we check length
  let phone = matches[1] || '';
  if(phone.length >= 10) {
    validCount++;
    if(validCount <= 42) {
      // It might already have "Pending", so we replace it, or append if missing
      let cleanLine = lines[i].trim();
      if(cleanLine.endsWith(',"Pending"')) {
         cleanLine = cleanLine.replace(',"Pending"', ',"Sent"');
      } else if (!cleanLine.endsWith(',"Sent"') && !cleanLine.endsWith(',"Invalid Phone"')) {
         cleanLine += ',"Sent"';
      }
      newLines.push(cleanLine);
    } else {
      let cleanLine = lines[i].trim();
      if(!cleanLine.endsWith(',"Pending"') && !cleanLine.endsWith(',"Sent"') && !cleanLine.endsWith(',"Invalid Phone"')) {
         cleanLine += ',"Pending"';
      }
      newLines.push(cleanLine);
    }
  } else {
    newLines.push(lines[i].trim() + ',"Invalid Phone"');
  }
}

fs.writeFileSync(path, newLines.join('\n'));
console.log('CSV Updated!');
