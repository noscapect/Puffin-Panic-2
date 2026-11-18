$ErrorActionPreference = 'Stop'
$root = (Get-Item (Join-Path $PSScriptRoot '..')).FullName
$mime = @{ '.html'='text/html'; '.js'='text/javascript'; '.mjs'='text/javascript'; '.json'='application/json'; '.png'='image/png'; '.jpeg'='image/jpeg'; '.jpg'='image/jpeg'; '.svg'='image/svg+xml'; '.css'='text/css'; '.webp'='image/webp' }
$server = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 8000)
try {
    try { $server.Start() } catch [Net.Sockets.SocketException] {
        if ($_.Exception.SocketErrorCode -ne 'AddressAlreadyInUse') { throw }
        $server = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
        $server.Start()
    }
    $url = "http://127.0.0.1:$($server.LocalEndpoint.Port)/"
    Write-Host "Puffins Panic: $url"
    Write-Host 'Close this window to stop the game server.'
    Start-Process $url
    while ($true) {
        $client = $server.AcceptTcpClient()
        try {
            $client.ReceiveTimeout = 1500
            $stream = $client.GetStream()
            $reader = [IO.StreamReader]::new($stream)
            $request = $reader.ReadLine()
            if (!$request) { continue }
            while ($reader.ReadLine()) {}
            $resource = ($request -split ' ')[1] -replace '\?.*$', ''
            if ($resource -eq '/') { $resource = '/index.html' }
            $status = '404 Not Found'
            $body = [byte[]]@()
            $type = 'text/plain'
            if ($resource -match '^/(index\.html|scripts/replay-classic\.mjs|(?:js|levels|img)/[\w./-]+)$' -and !$resource.Contains('..')) {
                $file = Join-Path $root $resource.Substring(1)
                if ([IO.File]::Exists($file)) {
                    $body = [IO.File]::ReadAllBytes($file)
                    $status = '200 OK'
                    $type = $mime[[IO.Path]::GetExtension($file)]
                    if (!$type) { $type = 'application/octet-stream' }
                }
            }
            $header = [Text.Encoding]::ASCII.GetBytes("HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n")
            $stream.Write($header, 0, $header.Length)
            $stream.Write($body, 0, $body.Length)
        } catch [IO.IOException] {
            # Browsers may close speculative connections before sending a request.
        } finally {
            $client.Close()
        }
    }
} finally {
    $server.Stop()
}
