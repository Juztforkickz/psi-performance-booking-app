from pathlib import Path
import hashlib, json, re, subprocess, tempfile, uuid

root=Path(__file__).resolve().parents[1]
ff=root/'tools/ffmpeg.exe'
report=[]
expected={
    'PSI-Performance-App-15s-Reel-9x16.mp4': (15,1080,1920),
    'PSI-Performance-App-36s-Reel-9x16.mp4': (36,1080,1920),
    'PSI-Performance-App-36s-Feed-4x5.mp4': (36,1080,1350),
    'PSI-App-Launch-Opening-Reel-9x16.mp4': (3,1080,1920),
    'PSI-App-Launch-Opening-Feed-4x5.mp4': (3,1080,1350),
    'PSI-App-Launch-Opening-Short-Reel-9x16.mp4': (2,1080,1920),
    'PSI-Trusted-Teams-One-Page-9x16.mp4': (6,1080,1920),
    'PSI-Trusted-Teams-One-Page-4x5.mp4': (6,1080,1350),
    'psi-app-arrived-loop-16x9.mp4': (12,1920,1080),
    'psi-app-preview-loop-16x9.mp4': (12,1920,1080),
}
for folder in ['social','website']:
    for file in sorted((root/folder).glob('*.mp4')):
        check=subprocess.run([str(ff),'-hide_banner','-nostats','-xerror','-i',str(file),'-f','null','-'],capture_output=True,text=True)
        if check.returncode: raise RuntimeError(check.stderr[-2000:])
        input_info=check.stderr.split('Stream mapping:',1)[0]
        duration_match=re.search(r'Duration: (\d+:\d+:\d+(?:\.\d+)?)',input_info)
        if not duration_match: raise RuntimeError(f'{file.name}: missing duration')
        duration=duration_match.group(1)
        hours,minutes,seconds=map(float,duration.split(':'))
        duration_seconds=hours*3600+minutes*60+seconds
        if duration_seconds <= 0: raise RuntimeError(f'{file.name}: empty video')
        input_video=next((line.strip() for line in input_info.splitlines() if 'Stream #0:' in line and 'Video:' in line),None)
        if not input_video: raise RuntimeError(f'{file.name}: missing video stream')
        dimensions=re.search(r'\b(\d{2,5})x(\d{2,5})\b',input_video)
        if not dimensions: raise RuntimeError(f'{file.name}: missing video dimensions')
        width,height=map(int,dimensions.groups())
        has_audio=any('Stream #0:' in line and 'Audio:' in line for line in input_info.splitlines())
        if has_audio: raise RuntimeError(f'{file.name}: unexpected audio in the silent campaign')
        if file.name in expected:
            expected_duration,expected_width,expected_height=expected[file.name]
            if abs(duration_seconds-expected_duration)>0.05 or (width,height)!=(expected_width,expected_height):
                raise RuntimeError(f'{file.name}: expected {expected_duration}s {expected_width}x{expected_height}, got {duration_seconds}s {width}x{height}')
        with file.open('rb') as stream:
            sha256=hashlib.file_digest(stream,'sha256').hexdigest()
        report.append({'file':file.relative_to(root).as_posix(),'duration':duration,'video':input_video,'width':width,'height':height,'bytes':file.stat().st_size,'sha256':sha256,'full_decode':'passed','audio':'silent'})
        print(file.name,duration,'full decode passed',flush=True)
        if folder=='social':
            poster=file.with_name(file.stem+'-Cover.jpg')
            poster_time=min(4,duration_seconds/2)
            # A unique temporary image prevents a failed zero-frame extraction
            # from silently reusing an earlier cover. Replace only after success.
            with tempfile.TemporaryDirectory(prefix='cover-check-',dir=root/'preview') as temporary:
                extracted=Path(temporary)/'cover.jpg'
                subprocess.run([str(ff),'-hide_banner','-loglevel','error','-xerror','-ss',str(poster_time),'-i',str(file),'-frames:v','1','-q:v','2','-y',str(extracted)],check=True)
                if not extracted.is_file() or extracted.stat().st_size==0:
                    raise RuntimeError(f'{file.name}: no cover frame was extracted')
                # TemporaryDirectory is owner-only on Windows. Publish a fresh
                # sibling so the delivered cover inherits the social folder's
                # normal permissions rather than the temporary directory ACL.
                published=poster.with_name(f'.{poster.stem}-{uuid.uuid4().hex}.jpg')
                try:
                    published.write_bytes(extracted.read_bytes())
                    published.replace(poster)
                finally:
                    published.unlink(missing_ok=True)
            report[-1]['cover_sample_seconds']=poster_time
(root/'preview/media-validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
