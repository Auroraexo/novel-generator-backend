# SSH tunnel: localhost 15432/16379 -> server 127.0.0.1:15432/16379
$ErrorActionPreference = "Stop"
$server = "root@107.173.156.235"

function Test-Port([int]$Port) {
  try {
    $client = New-Object Net.Sockets.TcpClient
    $task = $client.ConnectAsync("127.0.0.1", $Port)
    $ok = $task.Wait(1500) -and $client.Connected
    $client.Close()
    return $ok
  } catch {
    return $false
  }
}

if (Test-Port 15432) {
  Write-Host "[tunnel] already running (port 15432 ok)"
  exit 0
}

$sshArgs = @(
  "-N",
  "-o", "ServerAliveInterval=30",
  "-o", "ServerAliveCountMax=3",
  "-o", "ExitOnForwardFailure=yes",
  "-o", "BatchMode=yes",
  "-L", "15432:127.0.0.1:15432",
  "-L", "16379:127.0.0.1:16379",
  $server
)

Write-Host "[tunnel] starting SSH tunnel to $server ..."
Start-Process -FilePath "ssh.exe" -ArgumentList $sshArgs -WindowStyle Hidden

for ($i = 0; $i -lt 15; $i++) {
  Start-Sleep -Seconds 1
  if ((Test-Port 15432) -and (Test-Port 16379)) {
    Write-Host "[tunnel] ready: localhost:15432 (postgres), localhost:16379 (redis)"
    exit 0
  }
}

Write-Host "[tunnel] failed. check:" -ForegroundColor Red
Write-Host "  ssh -o BatchMode=yes $server echo ok"
Write-Host "  server: docker ps | grep novel"
exit 1
