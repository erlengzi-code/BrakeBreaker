param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'game'))
if (-not (Test-Path -LiteralPath (Join-Path $root 'index.html'))) {
    Write-Error 'Game files are missing. Extract the complete package again.'
    exit 1
}
$rootPrefix = $root.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = ([Net.IPEndPoint]$listener.LocalEndpoint).Port
$address = "http://127.0.0.1:$port/"
$mime = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.mjs'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.json'='application/json; charset=utf-8'; '.svg'='image/svg+xml'; '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.webp'='image/webp'; '.ico'='image/x-icon'; '.woff2'='font/woff2'; '.wasm'='application/wasm' }
Write-Host "Brake Lab is running at $address" -ForegroundColor Cyan
Write-Host 'Press Ctrl+C in this window to stop the game server.' -ForegroundColor DarkGray
if (-not $NoBrowser) { try { Start-Process $address } catch { Write-Host 'Open the URL above in your browser.' } }
try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
        try {
            $requestLine = $reader.ReadLine()
            while ($line = $reader.ReadLine()) { }
            if ([string]::IsNullOrWhiteSpace($requestLine)) { $client.Close(); continue }
            $parts = $requestLine.Split(' ')
            $method = $parts[0]
            $status = 200
            $reason = 'OK'
            $contentType = 'text/plain; charset=utf-8'
            $bytes = [Text.Encoding]::UTF8.GetBytes('Not found')
            if ($method -ne 'GET' -and $method -ne 'HEAD') {
                $status = 405; $reason = 'Method Not Allowed'
                $bytes = [Text.Encoding]::UTF8.GetBytes('Method not allowed')
            } else {
                $relative = [Uri]::UnescapeDataString(([Uri]::new([Uri]$address, $parts[1])).AbsolutePath).TrimStart([char[]]@('/', '\'))
                if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
                $file = [IO.Path]::GetFullPath((Join-Path $root $relative))
                if (-not $file.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
                    $status = 403; $reason = 'Forbidden'; $bytes = [Text.Encoding]::UTF8.GetBytes('Forbidden')
                } elseif (Test-Path -LiteralPath $file -PathType Leaf) {
                    $bytes = [IO.File]::ReadAllBytes($file)
                    $ext = [IO.Path]::GetExtension($file).ToLowerInvariant()
                    if ($mime.ContainsKey($ext)) { $contentType = $mime[$ext] } else { $contentType = 'application/octet-stream' }
                } else { $status = 404; $reason = 'Not Found' }
            }
            $header = "HTTP/1.1 $status $reason`r`nContent-Type: $contentType`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
            $headerBytes = [Text.Encoding]::ASCII.GetBytes($header)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            if ($method -eq 'GET' -and $bytes.Length -gt 0) { $stream.Write($bytes, 0, $bytes.Length) }
            $stream.Flush()
        } catch {
            Write-Host "Request failed: $($_.Exception.Message)" -ForegroundColor Yellow
        } finally {
            $reader.Dispose()
            $client.Close()
        }
    }
} finally {
    $listener.Stop()
}
