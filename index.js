// Patch dynamic import if needed (for Node.js v18+)
import('module').then(module => {
  global.__importModule = module;
});

const express = require('express');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const port = process.env.PORT || 8080;

// ✅ HEALTH CHECK (For UptimeRobot or cron-job.org)
app.get('/healthz', (req, res) => {
  res.send('OK');
});

// This is what parses the incoming JSON request
app.use(express.json());

app.post('/analyze', async (req, res) => {
  console.log(" Incoming Body:", req.body.files);
  const files = req.body.files;

  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'Request must include a non-empty files array' });
  }

  const results = [];

  // Process each file in sequence
  for (const file of files) {
    const { code, fileName } = file;

    if (!code || !fileName) {
      results.push({ fileName, error: 'Missing code or fileName' });
      continue;
    }

    const timestamp = Date.now();
    const filePath = `./temp/${timestamp}_${fileName}`;

    try {
      fs.mkdirSync('./temp', { recursive: true });
      fs.writeFileSync(filePath, code);

      // Use Promise-wrapped exec to wait for result
      const analysis = await new Promise((resolve, reject) => {
        exec(`sfdx scanner:run --target ${filePath} --format json`, (err, stdout, stderr) => {
          fs.unlinkSync(filePath); // Clean up temp file
          if (err) return resolve({ fileName, error: stderr || err.message });

          try {
            const output = JSON.parse(stdout);
            resolve({ fileName, result: output });
          } catch (parseErr) {
            resolve({ fileName, error: 'Failed to parse scanner output' });
          }
        });
      });

      results.push(analysis);

    } catch (err) {
      results.push({ fileName, error: err.message });
    }
  }

  // Return results for all files
  res.json({ results });
});


app.listen(port, () => {
  console.log(`Analyzer running on port ${port}`);
});
