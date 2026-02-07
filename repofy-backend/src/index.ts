import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

app.listen(env.port, () => {
  console.log(`[repofy-backend] Server running on port ${env.port}`);
  console.log(`[repofy-backend] Environment: ${env.nodeEnv}`);
});
