const glob = require('glob');
const fs = require('fs');

const files = glob.sync('src/app/**/*.tsx');
for (const f of files) {
    const lines = fs.readFileSync(f, 'utf-8').split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('.reduce((s, v) => s + v, 0) /') || lines[i].includes('.reduce((s, a) => s + (a.achievementPercentage || 0), 0) /')) {
            console.log(`--- ${f}:${i+1} ---`);
            const start = Math.max(0, i - 5);
            const end = Math.min(lines.length, i + 6);
            for (let j = start; j < end; j++) {
                console.log(lines[j].trimEnd());
            }
        }
    }
}
