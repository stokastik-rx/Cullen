# PowerShell script to kill process using a specific port
param(
    [int]$Port = 8000
)

Write-Host "Checking for processes using port $Port..." -ForegroundColor Yellow

$processes = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

if ($processes) {
    foreach ($procId in $processes) {
        $process = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "Found process: $($process.ProcessName) (PID: $procId)" -ForegroundColor Red
            Stop-Process -Id $procId -Force
            Write-Host "Killed process $procId" -ForegroundColor Green
        }
    }
    Write-Host "Port $Port is now free!" -ForegroundColor Green
} else {
    Write-Host "No process found using port $Port" -ForegroundColor Green
}

