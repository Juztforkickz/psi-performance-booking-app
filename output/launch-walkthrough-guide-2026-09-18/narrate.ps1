$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$repositoryPath = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$narrationPath = Join-Path $repositoryPath 'work/launch-walkthrough-guide-2026-09-18/narration'
$lines = Get-Content -LiteralPath (Join-Path $narrationPath 'script.json') -Raw | ConvertFrom-Json
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speaker.SelectVoice('Microsoft James')
$speaker.Rate = 0
$speaker.Volume = 95
try {
    foreach ($line in $lines) {
        $voicePath = Join-Path $narrationPath ($line.id + '.wav')
        $speaker.SetOutputToWaveFile($voicePath)
        $spokenText = [regex]::Replace($line.text, '\bPSI\b', 'P S I')
        $speaker.Speak($spokenText)
        $speaker.SetOutputToNull()
        Write-Output ('Narrated ' + $line.id)
    }
} finally {
    $speaker.Dispose()
}
