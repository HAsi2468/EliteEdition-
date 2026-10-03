import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function versionPlugin() {
  return {
    name: 'vite-plugin-version',
    buildStart() {
      let commitHash = 'unknown';
      try {
        commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
      } catch (e) {
        // Fallback
      }

      const versionData = {
        version: Date.now(),
        gitCommit: commitHash,
        buildTime: new Date().toISOString(),
      };

      const publicDir = path.resolve(__dirname, 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      fs.writeFileSync(path.join(publicDir, 'version.json'), JSON.stringify(versionData, null, 2));
    },
    closeBundle() {
      let commitHash = 'unknown';
      try {
        commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
      } catch (e) {
        // Fallback
      }

      const versionData = {
        version: Date.now(),
        gitCommit: commitHash,
        buildTime: new Date().toISOString(),
      };

      const distDir = path.resolve(__dirname, 'dist');
      if (fs.existsSync(distDir)) {
        fs.writeFileSync(path.join(distDir, 'version.json'), JSON.stringify(versionData, null, 2));
      }
    }
  };
}
