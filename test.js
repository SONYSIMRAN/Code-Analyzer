const express = require('express');
const app = express();
const port = 3000;

// This line is what makes req.body work for JSON
app.use(express.json());

app.post('/test', (req, res) => {
  console.log('Received body:', req.body);

  const { code, fileName } = req.body;

  if (!code || !fileName) {
    return res.status(400).json({ error: 'Missing code or fileName' });
  }

  return res.status(200).json({ message: 'Success', received: { code, fileName } });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
