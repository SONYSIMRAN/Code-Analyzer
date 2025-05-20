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

// ✅ Increase request body size limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// This is what parses the incoming JSON request
// app.use(express.json());

// app.post('/analyze', async (req, res) => {
//   console.log(" Incoming Body:", req.body.files);
//   const files = req.body.files;

//   if (!Array.isArray(files) || files.length === 0) {
//     return res.status(400).json({ error: 'Request must include a non-empty files array' });
//   }

//   const results = [];

//   // Process each file in sequence
//   for (const file of files) {
//     const { code, fileName } = file;

//     if (!code || !fileName) {
//       results.push({ fileName, error: 'Missing code or fileName' });
//       continue;
//     }

//     const timestamp = Date.now();
//     const filePath = `./temp/${timestamp}_${fileName}`;

//     try {
//       fs.mkdirSync('./temp', { recursive: true });
//       fs.writeFileSync(filePath, code);

//       // Use Promise-wrapped exec to wait for result
//       const analysis = await new Promise((resolve, reject) => {
//         exec(`sfdx scanner:run --target ${filePath} --format json`, (err, stdout, stderr) => {
//           fs.unlinkSync(filePath); // Clean up temp file
//           if (err) return resolve({ fileName, error: stderr || err.message });

//           try {
//             const output = JSON.parse(stdout);
//             resolve({ fileName, result: output });
//           } catch (parseErr) {
//             resolve({ fileName, error: 'Failed to parse scanner output' });
//           }
//         });
//       });

//       results.push(analysis);

//     } catch (err) {
//       results.push({ fileName, error: err.message });
//     }
//   }

//   // Return results for all files
//   res.json({ results });
// });



  app.post('/analyze', async (req, res) => {
    console.log(" Incoming Body:", req.body.files);
    const files = req.body.files;

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Request must include a non-empty files array' });
    }

    const results = [];

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

        const analysis = await new Promise((resolve) => {
          exec(`sfdx scanner:run --target ${filePath} --format json`, (err, stdout, stderr) => {
            fs.unlinkSync(filePath);

            if (err || !stdout) {
              return resolve({ fileName, error: stderr || err.message });
            }

            try {
              const parsed = JSON.parse(stdout);

              // Attach scores per engine result
              parsed.forEach(result => {
                const violations = result.violations || [];
                let high = 0, medium = 0, low = 0;

                for (const v of violations) {
                  const severity = parseInt(v.severity, 10);
                  if (severity === 1) high++;
                  else if (severity === 2) medium++;
                  else low++;
                }

                const deduction = high * 10 + medium * 5 + low * 1;
                result.score = Math.max(0, 100 - deduction);
              });

              // Compute average score for this file
              const scores = parsed.map(r => r.score).filter(s => typeof s === 'number');
              const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100;

              // Assign grade
              let grade = 'D';
              if (avgScore >= 90) grade = 'A';
              else if (avgScore >= 75) grade = 'B';
              else if (avgScore >= 60) grade = 'C';

              resolve({
                fileName,
                result: parsed,
                grade
              });

            } catch (e) {
              resolve({ fileName, error: 'Failed to parse scanner output' });
            }
          });
        });

        results.push(analysis);
      } catch (err) {
        results.push({ fileName, error: err.message });
      }
    }

    // Calculate overall quality score
    const allScores = results.flatMap(r => (r.result || []).map(x => x.score).filter(s => typeof s === 'number'));
    const overallQualityScore = allScores.length
      ? Math.round(allScores.reduce((sum, score) => sum + score, 0) / allScores.length)
      : null;

    res.json({ overallQualityScore, results });
  });


app.listen(port, () => {
  console.log(`Analyzer running on port ${port}`);
});
