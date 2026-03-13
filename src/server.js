// server.js - FINAL CORRECT VERSION
require("dotenv").config();
const app = require("./app"); // ✅ app.js-ல இருந்து import பண்ணு

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});