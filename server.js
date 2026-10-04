import http from 'node:http';
import { createAddon } from './src/addon.js';

const port = Number(process.env.PORT) || 7000;

if (!process.env.OS_API_KEY || !process.env.CONFIG_SECRET) {
  console.warn('UYARI: OS_API_KEY veya CONFIG_SECRET ayarlanmamış. .env.example dosyasına bak.');
}

http.createServer(createAddon()).listen(port, () => {
  console.log(`Ayar sayfası: http://127.0.0.1:${port}/`);
});
