const glob = require('glob');
const fs = require('fs');

const files = glob.sync('src/app/**/*.tsx');
for (const f of files) {
    let content = fs.readFileSync(f, 'utf-8');
    if (content.includes('useKpiSettings')) {
        let changed = false;
        
        if (f.includes('hr/reports') || f.includes('head/reports') || f.includes('head/penugasan') || f.includes('executive/')) {
            content = content.replace(/import \{ useKpiSettings \} from "@\/hooks\/useKpiSettings";/g, 'import { useAllKpiSettings } from "@/hooks/useKpiSettings";');
            content = content.replace(/const \{ getWeights(?:, isLoading: [a-zA-Z]+)? \} = useKpiSettings\(\);/g, 'const { getWeights } = useAllKpiSettings();');
            changed = true;
        }
        
        if (changed) {
            fs.writeFileSync(f, content, 'utf-8');
            console.log("Fixed " + f);
        }
    }
}
