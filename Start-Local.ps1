# Starts only the local API, using the workspace SQLite database.
param(
    [string]$Username,
    [ValidateRange(1, 2147483647)]
    [int]$AdminUserId
)

$ErrorActionPreference = 'Stop'
$backendDirectory = Join-Path $PSScriptRoot 'BackEnd'
$projectFile = Join-Path $backendDirectory 'GestionMesas.Api.csproj'
$binaryDirectory = [System.IO.Path]::GetFullPath((Join-Path $backendDirectory 'bin')) + [System.IO.Path]::DirectorySeparatorChar
$runId = [guid]::NewGuid().ToString('N').Substring(0, 12)
$buildOutput = 'bin/local-dev/runs/' + $runId + '/'
$executable = Join-Path $backendDirectory ($buildOutput + 'Debug/net10.0/GestionMesas.Api.exe')
$databaseFile = Join-Path $backendDirectory 'gestion-mesas.db'

$previousEnvironment = $env:ASPNETCORE_ENVIRONMENT
$previousDotnetEnvironment = $env:DOTNET_ENVIRONMENT
$previousPort = $env:PORT
$previousOrigin = $env:Cors__AllowedOrigins__0
$previousPassword = $env:Authentication__AdminPassword
$previousUsername = $env:Authentication__AdminUsername
$previousAdminUserId = $env:Authentication__AdminUserId
$previousConnection = $env:ConnectionStrings__Restaurant

try {
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    $env:DOTNET_ENVIRONMENT = 'Development'
    $env:PORT = '5000'
    $env:Cors__AllowedOrigins__0 = 'http://localhost:5173'
    $env:ConnectionStrings__Restaurant = 'Data Source=' + $databaseFile
    if ($PSBoundParameters.ContainsKey('Username')) {
        $Username = $Username.Trim()
        if ([string]::IsNullOrWhiteSpace($Username) -or $Username.Length -gt 100 -or $Username -match '\p{Cc}') {
            throw 'El usuario debe tener entre 1 y 100 caracteres, sin caracteres de control.'
        }
        $env:Authentication__AdminUsername = $Username
    }
    if ($PSBoundParameters.ContainsKey('AdminUserId')) { $env:Authentication__AdminUserId = $AdminUserId.ToString() }
    if ([string]::IsNullOrEmpty($env:Authentication__AdminPassword)) {
        $securePassword = Read-Host 'Clave de acceso (actual para conservarla, o nueva para cambiarla)' -AsSecureString
        try {
            $env:Authentication__AdminPassword = [System.Net.NetworkCredential]::new('', $securePassword).Password
        }
        finally { $securePassword.Dispose() }
    }
    $password = $env:Authentication__AdminPassword
    if ([string]::IsNullOrWhiteSpace($password) -or $password.Length -gt 1024 -or
        $password.Equals('admin', [System.StringComparison]::OrdinalIgnoreCase) -or
        $password.IndexOf('CHANGE_ME', [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
        throw 'La clave no puede estar vacia, superar 1024 caracteres ni ser admin o un valor de ejemplo.'
    }
    $password = $null

    # A fresh output directory also supports restarting an API launched by this same script.
    & dotnet build $projectFile ('-p:BaseOutputPath=' + $buildOutput)
    if ($LASTEXITCODE -ne 0) { throw 'La compilación falló. No se detuvo el backend anterior.' }
    if (-not (Test-Path -LiteralPath $executable)) { throw 'No se encontró el ejecutable local compilado.' }

    $listeners = @(Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue)
    $backendProcesses = @()
    foreach ($backendProcessId in @($listeners.OwningProcess | Sort-Object -Unique)) {
        $backendProcess = Get-Process -Id $backendProcessId -ErrorAction Stop
        $processFile = [System.IO.Path]::GetFullPath($backendProcess.Path)
        if ($backendProcess.ProcessName -ne 'GestionMesas.Api' -or
            -not $processFile.StartsWith($binaryDirectory, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw 'El puerto 5000 pertenece a otro programa. No se detuvo ningún proceso.'
        }
        $backendProcesses += $backendProcess
    }
    foreach ($backendProcess in $backendProcesses) {
        Stop-Process -Id $backendProcess.Id -ErrorAction Stop
        $backendProcess.WaitForExit()
    }

    # Preserve the main database and any remaining WAL together after stopping the old API.
    if (Test-Path -LiteralPath $databaseFile) {
        $backupDirectory = Join-Path $backendDirectory ('bin/local-dev/backups/' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
        New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
        foreach ($databasePart in @($databaseFile, ($databaseFile + '-wal'), ($databaseFile + '-shm'))) {
            if (Test-Path -LiteralPath $databasePart) {
                Copy-Item -LiteralPath $databasePart -Destination $backupDirectory
            }
        }
        Write-Host ('Respaldo local guardado en ' + $backupDirectory)
    }

    Write-Host 'Iniciando la API actualizada en http://localhost:5000.'
    if ($env:Authentication__AdminUsername) {
        Write-Host ('Usuario: ' + $env:Authentication__AdminUsername + '. Usá la contraseña que ingresaste.')
    }
    else {
        Write-Host 'Usá el usuario que ya tenías guardado (admin en una base nueva) y la contraseña que ingresaste.'
    }
    Write-Host 'Cuando aparezca el mensaje de inicio, recargá el frontend. Ctrl+C detiene esta API local.'
    Push-Location -LiteralPath $backendDirectory
    try { & $executable '--urls' 'http://localhost:5000' }
    finally { Pop-Location }
}
finally {
    $env:ASPNETCORE_ENVIRONMENT = $previousEnvironment
    $env:DOTNET_ENVIRONMENT = $previousDotnetEnvironment
    $env:PORT = $previousPort
    $env:Cors__AllowedOrigins__0 = $previousOrigin
    $env:Authentication__AdminPassword = $previousPassword
    $env:Authentication__AdminUsername = $previousUsername
    $env:Authentication__AdminUserId = $previousAdminUserId
    $env:ConnectionStrings__Restaurant = $previousConnection
    $previousPassword = $null
    $previousConnection = $null
}
