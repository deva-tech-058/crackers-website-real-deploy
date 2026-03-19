require("dotenv").config();

const app = require("./app");
const appConfig = require("./config/app.config");

app.listen(appConfig.port, () => {
  console.log(`Server running on port ${appConfig.port} (${appConfig.nodeEnv})`);
});

