import('module').then(module => {
  global.__importModule = module;
});

const express = require('express');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const port = process.env.PORT || 8080;
app.use(express.json({ limit: '20mb' })); // ⬅️ Allow large payloads

app.post('/analyze', async (req, res) => {
  console.log("Received request with", req.body.files?.length, "files");

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
        const cmd = `sfdx scanner:run --target ${filePath} --format json`;

        // Set a hard timeout of 60s per file to avoid infinite hangs
        const process = exec(cmd, { timeout: 60000 }, (err, stdout, stderr) => {
          fs.unlinkSync(filePath);

          if (err || !stdout) {
            console.error(`Scanner failed for ${fileName}:`, stderr || err.message);
            return resolve({ fileName, error: stderr || err.message });
          }

          try {
            const parsed = JSON.parse(stdout);
            parsed.forEach(result => {
              const violations = result.violations || [];
              let high = 0, medium = 0, low = 0;
              violations.forEach(v => {
                const sev = parseInt(v.severity, 10);
                if (sev === 1) high++;
                else if (sev === 2) medium++;
                else low++;
              });
              const deduction = high * 10 + medium * 5 + low;
              result.score = Math.max(0, 100 - deduction);
            });

            const scores = parsed.map(r => r.score).filter(s => typeof s === 'number');
            const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100;

            let grade = 'D';
            if (avgScore >= 90) grade = 'A';
            else if (avgScore >= 75) grade = 'B';
            else if (avgScore >= 60) grade = 'C';

            // resolve({ fileName, result: parsed, grade });
            resolve({
            fileName,
            result: parsed,
            grade,
            metrics: (() => {
            const violations = parsed.flatMap(r => r.violations || []);

            // Coverage
            const coverage = fileName.toLowerCase().includes('test') || violations.some(v =>
              v.ruleName.toLowerCase().includes('test')) ? 100 : 0;

            // Automation
            const hasAssert = violations.some(v => v.ruleName === 'ApexUnitTestClassShouldHaveAsserts');
            const automation = hasAssert ? 50 : 100;

            // Performance
            const perfRules = ['AvoidSoqlInLoops', 'AvoidDmlStatementsInLoops', 'AvoidDeeplyNestedIfStmts'];
            const perfViolations = violations.filter(v => perfRules.includes(v.ruleName));
            const performance = Math.max(0, 100 - perfViolations.length * 10);

            // Dependency
            const depRules = ['ApexPublicMethodUnused', 'ExcessiveImports', 'TooManyFields'];
            const depViolations = violations.filter(v => depRules.includes(v.ruleName));
            const dependency = Math.max(0, 100 - depViolations.length * 10);

            return { coverage, automation, performance, dependency };
            })()
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

  // Final overall score
  const allScores = results.flatMap(r => (r.result || []).map(x => x.score).filter(s => typeof s === 'number'));
  const overallQualityScore = allScores.length
    ? Math.round(allScores.reduce((sum, score) => sum + score, 0) / allScores.length)
    : null;

  res.setHeader('Content-Type', 'application/json');
  res.json({ overallQualityScore, results });
});

app.listen(port, () => {
  console.log(`🚀 Analyzer running on port ${port}`);
});
