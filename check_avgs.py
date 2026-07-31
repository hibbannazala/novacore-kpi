import glob

files = glob.glob('src/app/**/*.tsx', recursive=True)
for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        lines = file.readlines()
        for i, line in enumerate(lines):
            if '.reduce((s, v) => s + v, 0) /' in line or '.reduce((s, a) => s + (a.achievementPercentage || 0), 0) /' in line:
                print(f"--- {f}:{i+1} ---")
                start = max(0, i-5)
                end = min(len(lines), i+6)
                for j in range(start, end):
                    print(lines[j].rstrip())
