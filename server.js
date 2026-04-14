const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, 'public');

// Serve static files under /public and resolve extensionless .html pages.
app.use('/public', express.static(publicDir, { extensions: ['html'] }));

// Also allow root-level serving for convenience.
app.use(express.static(publicDir, { extensions: ['html'] }));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Drop2Wave running at http://127.0.0.1:${PORT}`);
});
