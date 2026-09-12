from pathlib import Path
import json, re, subprocess

root=Path(__file__).resolve().parents[1]
ff=root/'tools/ffmpeg.exe'
report=[]
for folder in ['social','website']:
    for file in sorted((root/folder).glob('*.mp4')):
        check=subprocess.run([str(ff),'-hide_banner','-nostats','-i',str(file),'-f','null','-'],capture_output=True,text=True)
        if check.returncode: raise RuntimeError(check.stderr[-2000:])
        duration=re.search(r'Duration: ([\d:.]+)',check.stderr).group(1)
        input_video=next(line.strip() for line in check.stderr.splitlines() if 'Stream #0:0' in line and 'Video:' in line)
        report.append({'file':file.relative_to(root).as_posix(),'duration':duration,'video':input_video,'bytes':file.stat().st_size,'full_decode':'passed','audio':'silent'})
        print(file.name,duration,'full decode passed',flush=True)
        if folder=='social':
            poster=file.with_name(file.stem+'-Cover.jpg')
            subprocess.run([str(ff),'-hide_banner','-loglevel','error','-ss','4','-i',str(file),'-frames:v','1','-q:v','2','-y',str(poster)],check=True)
(root/'preview/media-validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
