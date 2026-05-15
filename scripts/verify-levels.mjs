import fs from 'fs';
import path from 'path';

console.log("Running QA Verification Sweep on first 10 levels...");

for (let i = 1; i <= 10; i++) {
  const filename = `level_${String(i).padStart(3, '0')}.json`;
  const filePath = path.join('levels', filename);
  
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let errors = [];
    
    // Check bounds
    if (data.entrance.x < 0 || data.entrance.x >= 400 || data.entrance.y < 0 || data.entrance.y >= 220) {
        errors.push("Entrance out of bounds.");
    }
    if (data.exit.x < 0 || data.exit.x >= 400 || data.exit.y < 0 || data.exit.y >= 220) {
        errors.push("Exit out of bounds.");
    }
    
    // Check logic
    if (data.required > data.total) {
        errors.push(`Unsolvable: required (${data.required}) > total (${data.total}).`);
    }
    if (data.total <= 0) {
        errors.push(`Unsolvable: 0 total puffins.`);
    }
    
    if (errors.length > 0) {
        console.log(`\x1b[31m[FAIL] ${filename}\x1b[0m`);
        errors.forEach(e => console.log(`       - ${e}`));
    } else {
        console.log(`\x1b[32m[PASS] ${filename}\x1b[0m`);
    }
  } else {
    console.log(`\x1b[33m[WARN] ${filename} not found.\x1b[0m`);
  }
}
