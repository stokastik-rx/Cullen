# PowerShell script to kill process using a specific port
param(
    [int]$Port = 8000
)

Write-Host "Checking for processes using port $Port..." -ForegroundColor Yellow

$processes = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

if ($processes) {
    foreach ($pid in $processes) {
        $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "Found process: $($process.ProcessName) (PID: $pid)" -ForegroundColor Red
            Stop-Process -Id $pid -Force
            Write-Host "Killed process $pid" -ForegroundColor Green
        }
    }
    Write-Host "Port $Port is now free!" -ForegroundColor Green
} else {
    Write-Host "No process found using port $Port" -ForegroundColor Green
}

