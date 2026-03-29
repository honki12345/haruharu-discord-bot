import { token } from './config.js';
import { bootstrapClient } from './runtime.js';

await bootstrapClient({ login: true, token });
