$ports = @(3000, 5173)
foreach ($p in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
        Write-Output ("PID=" + $c.OwningProcess + " Port=" + $p + " State=" + $c.State + " ProcName=" + $proc.ProcessName + " Started=" + $proc.StartTime)
    }
}
