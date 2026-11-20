/* Allowlisted static artifact: never deploy .git, dependencies, observations, or server code. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
const destination = path.join(root, '_site');
fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });
const pages = ['index.html', 'game.html', 'reviews.html', 'flagged-for-review.html', '404.html', '.nojekyll'];
for (const file of pages) fs.copyFileSync(path.join(root, file), path.join(destination, file));
fs.cpSync(path.join(root, 'assets'), path.join(destination, 'assets'), { recursive: true });
const commit = process.env.GITHUB_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
fs.writeFileSync(path.join(destination, 'build-info.json'), JSON.stringify({ repository: 'snapquast73-boop/LIVPBP', commit, builtAt: new Date().toISOString() }, null, 2) + '\n');
console.log(`Static site built: ${destination}; source commit ${commit}`);
