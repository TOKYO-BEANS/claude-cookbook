param(
    [ValidateSet('list', 'status', 'save', 'import', 'remove', 'run', 'headers', 'self-test')]
    [string]$Mode = 'list',
    [string]$Name,
    [string]$EnvVar,
    [string]$FromEnv,
    [string]$FromFile,
    [string]$Program,
    [string[]]$ProgramArguments = @()
)

# Generic store for API keys, encrypted with Windows user-scoped DPAPI. Same
# hardening as parallel-key.ps1; storage sits under the profile root (not AppData,
# which the Claude Code MSIX container virtualises) in a folder that only this
# user and SYSTEM can open. Never accepts a key value in arguments and never
# prints one, except `headers`, which exists for programs (a Codex
# http_headers_helper, the Firecrawl wrappers) - do not run it in a shell whose
# output a person or transcript will see.
#
#   list | status -Name x                       redacted checks
#   save -Name x                                masked entry window
#   import -Name x -FromEnv VAR | -FromFile p   migrate an existing plaintext key
#   remove -Name x
#   run -Name x -EnvVar VAR -Program exe [-ProgramArguments a,b]
#   headers -Name x                             {"Authorization":"Bearer ..."}
#   self-test                                   synthetic values only

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
$secretDirectory = Join-Path $env:USERPROFILE '.secrets'

function Get-SecretPath([string]$Directory, [string]$KeyName) {
    if ($KeyName -notmatch '^[a-z0-9][a-z0-9-]{0,40}$') { throw '-Name must be lower-case letters, digits and hyphens.' }
    return (Join-Path $Directory "$KeyName.dpapi")
}

function Assert-NotLink([string]$Path, [string]$What) {
    if ((Test-Path -LiteralPath $Path) -and ((Get-Item -LiteralPath $Path -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "The credential $What must not be a link."
    }
}

function Protect-KeyDirectory([string]$Path) {
    [void][IO.Directory]::CreateDirectory($Path)
    Assert-NotLink $Path 'directory'
    $acl = [Security.AccessControl.DirectorySecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($sid in @([Security.Principal.WindowsIdentity]::GetCurrent().User,
        [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
        [void]$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
            $sid, 'FullControl', 'ContainerInherit, ObjectInherit', 'None', 'Allow'))
    }
    [IO.Directory]::SetAccessControl($Path, $acl)
}

function Save-Key([securestring]$Secure, [string]$Path) {
    if ($Secure.Length -eq 0) { throw 'The API key is empty.' }
    $directory = [IO.Path]::GetDirectoryName($Path)
    Protect-KeyDirectory $directory
    Assert-NotLink $Path 'file'
    $temporary = Join-Path $directory ([guid]::NewGuid().ToString() + '.tmp')
    try {
        [IO.File]::WriteAllText($temporary, (ConvertFrom-SecureString $Secure), [Text.Encoding]::ASCII)
        if ([IO.File]::Exists($Path)) {
            [IO.File]::Replace($temporary, $Path, [Management.Automation.Language.NullString]::Value)
        } else {
            [IO.File]::Move($temporary, $Path)
        }
    } finally {
        if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) }
    }
}

function Read-Key([string]$Path) {
    if (-not [IO.File]::Exists($Path)) { throw "No key saved at $Path. Run -Mode save or -Mode import first." }
    Assert-NotLink $Path 'file'
    return (ConvertTo-SecureString ([IO.File]::ReadAllText($Path).Trim()))
}

function Use-PlainKey([securestring]$Secure, [scriptblock]$Action) {
    $pointer = [IntPtr]::Zero
    try {
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
        & $Action ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer))
    } finally {
        if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    }
}

function Get-Sha256([string]$Text) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text))) } finally { $sha.Dispose() }
}

function ConvertTo-ArgumentString([string[]]$Arguments) {
    # Windows command-line quoting (CommandLineToArgvW rules).
    $quoted = foreach ($a in $Arguments) {
        if ($a -ne '' -and $a -notmatch '[\s"]') { $a; continue }
        $sb = [Text.StringBuilder]::new('"'); $slashes = 0
        foreach ($c in $a.ToCharArray()) {
            if ($c -eq '\') { $slashes++; continue }
            if ($c -eq '"') { [void]$sb.Append('\', 2 * $slashes + 1) } elseif ($slashes) { [void]$sb.Append('\', $slashes) }
            $slashes = 0; [void]$sb.Append($c)
        }
        [void]$sb.Append('\', 2 * $slashes).Append('"'); $sb.ToString()
    }
    return ($quoted -join ' ')
}

function Invoke-WithKey([string]$Path, [string]$Variable, [string]$Exe, [string[]]$Arguments) {
    if ($Variable -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { throw '-EnvVar must be a valid environment variable name.' }
    $secure = Read-Key $Path
    try {
        return (Use-PlainKey $secure {
            param($plain)
            $psi = [Diagnostics.ProcessStartInfo]::new($Exe, (ConvertTo-ArgumentString $Arguments))
            $psi.UseShellExecute = $false   # child inherits this console's handles unchanged
            $psi.EnvironmentVariables[$Variable] = $plain
            $process = [Diagnostics.Process]::Start($psi)
            try { $process.WaitForExit(); $process.ExitCode } finally { $process.Dispose() }
        })
    } finally { $secure.Dispose() }
}

function Read-SourceValue {
    if ($FromEnv -and $FromFile) { throw 'Use -FromEnv or -FromFile, not both.' }
    if ($FromEnv) {
        $value = [Environment]::GetEnvironmentVariable($FromEnv, 'User')
        if ([string]::IsNullOrEmpty($value)) { $value = [Environment]::GetEnvironmentVariable($FromEnv, 'Process') }
        if ([string]::IsNullOrEmpty($value)) { throw "Environment variable $FromEnv is not set." }
        return $value.Trim()
    }
    if ($FromFile) {
        $line = [IO.File]::ReadAllLines($FromFile) | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith('#') } | Select-Object -First 1
        if (-not $line) { throw 'The file holds no key line.' }
        return $line
    }
    throw 'import needs -FromEnv or -FromFile.'
}

if ($Mode -eq 'self-test') {
    $testDirectory = Join-Path ([IO.Path]::GetTempPath()) ('agent-key-test-' + [guid]::NewGuid().ToString())
    $testPath = Get-SecretPath $testDirectory 'synthetic'
    try {
        foreach ($value in @('synthetic-first-key', 'synthetic-replacement-key')) {
            $testKey = ConvertTo-SecureString $value -AsPlainText -Force
            try { Save-Key $testKey $testPath } finally { $testKey.Dispose() }
            $read = Read-Key $testPath
            try { Use-PlainKey $read { param($p) if ($p -cne $value) { throw 'Encryption round-trip failed.' } } } finally { $read.Dispose() }
            if ([IO.File]::ReadAllText($testPath).Contains($value)) { throw 'Plaintext found in credential file.' }
        }
        $code = Invoke-WithKey $testPath 'AGENT_KEY_SELFTEST' (Join-Path $PSHOME 'powershell.exe') @('-NoProfile', '-Command', "if (`$env:AGENT_KEY_SELFTEST -ceq 'synthetic-replacement-key') { exit 0 } else { exit 7 }")
        if ($code -ne 0) { throw "run mode did not deliver the key to the child (exit $code)." }
        if ($env:AGENT_KEY_SELFTEST) { throw 'run mode leaked the key into this process.' }
        $code = Invoke-WithKey $testPath 'AGENT_KEY_SELFTEST' $env:ComSpec @('/d', '/c', 'exit 3')
        if ($code -ne 3) { throw 'run mode did not preserve the child exit code.' }
        if ((ConvertTo-ArgumentString @('a b', 'c"d', 'e\', '')) -cne '"a b" "c\"d" e\ ""') { throw 'Argument quoting check failed.' }
        $allowed = @([Security.Principal.WindowsIdentity]::GetCurrent().User.Value, 'S-1-5-18')
        $rules = (Get-Acl -LiteralPath $testPath).GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
        if ($rules.Count -ne 2 -or -not (Get-Acl -LiteralPath $testDirectory).AreAccessRulesProtected) { throw 'Credential ACL check failed.' }
        foreach ($rule in $rules) {
            if ($rule.IdentityReference.Value -notin $allowed -or $rule.AccessControlType -ne 'Allow') { throw 'Unexpected credential access grant.' }
        }
        Write-Output 'PASS: DPAPI save/read, atomic replacement, no plaintext at rest, private ACLs, run-mode env delivery without leaking into the parent, exit-code passthrough and argument quoting. Synthetic values only; no network calls.'
    } finally {
        if ([IO.File]::Exists($testPath)) { [IO.File]::Delete($testPath) }
        if ([IO.Directory]::Exists($testDirectory)) { [IO.Directory]::Delete($testDirectory, $true) }
    }
    exit 0
}

if ($Mode -eq 'list') {
    if (-not [IO.Directory]::Exists($secretDirectory)) { Write-Output 'No keys saved.'; exit 0 }
    Get-ChildItem -LiteralPath $secretDirectory -Filter '*.dpapi' | ForEach-Object { $_.BaseName }
    exit 0
}

if (-not $Name) { throw '-Name is required for this mode.' }
$secretPath = Get-SecretPath $secretDirectory $Name

switch ($Mode) {
    'status' {
        if (-not [IO.File]::Exists($secretPath)) { Write-Output "${Name}: not saved."; exit 2 }
        $secure = Read-Key $secretPath
        try {
            if ($secure.Length -eq 0) { throw 'Stored key is empty.' }
            Write-Output "${Name}: saved and decryptable by this Windows user. API validity is not checked by status."
        } finally { $secure.Dispose() }
        exit 0
    }
    'import' {
        $plain = Read-SourceValue
        if ($plain -match '\s') { throw 'The source value contains whitespace; refusing to import it.' }
        $secure = ConvertTo-SecureString $plain -AsPlainText -Force
        try { Save-Key $secure $secretPath } finally { $secure.Dispose() }
        $sourceHash = Get-Sha256 $plain; $plain = $null
        $read = Read-Key $secretPath
        try { $storedHash = Use-PlainKey $read { param($p) Get-Sha256 $p } } finally { $read.Dispose() }
        if ($storedHash -cne $sourceHash) { throw 'Verification failed: the stored key does not match the source.' }
        Write-Output "${Name}: imported with Windows user-scoped encryption and verified against the source. The source was not changed."
        exit 0
    }
    'remove' {
        if ([IO.File]::Exists($secretPath)) { Assert-NotLink $secretPath 'file'; [IO.File]::Delete($secretPath); Write-Output "${Name}: removed." } else { Write-Output "${Name}: not saved." }
        exit 0
    }
    'headers' {
        $secure = Read-Key $secretPath
        try { Use-PlainKey $secure { param($p) [Console]::Out.Write((@{ Authorization = 'Bearer ' + $p } | ConvertTo-Json -Compress)) } } finally { $secure.Dispose() }
        exit 0
    }
    'run' {
        if ([string]::IsNullOrWhiteSpace($Program)) { throw '-Program is required for run mode.' }
        if (-not $EnvVar) { throw '-EnvVar is required for run mode.' }
        exit (Invoke-WithKey $secretPath $EnvVar $Program $ProgramArguments)
    }
    'save' {
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        [Windows.Forms.Application]::EnableVisualStyles()
        $form = [Windows.Forms.Form]::new()
        $form.Text = "Save API key '$Name' securely"
        $form.ClientSize = [Drawing.Size]::new(600, 230)
        $form.StartPosition = 'CenterScreen'
        $form.TopMost = $true
        $form.FormBorderStyle = 'FixedDialog'
        $form.MaximizeBox = $false
        $form.MinimizeBox = $false
        $label = [Windows.Forms.Label]::new()
        $label.Location = [Drawing.Point]::new(20, 16)
        $label.Size = [Drawing.Size]::new(560, 64)
        $label.Text = "Enter the API key for '$Name'. Do not paste it into chat.`r`nIt is encrypted for this Windows account and computer, and only this`r`nuser and SYSTEM can open its storage folder."
        $box = [Windows.Forms.TextBox]::new()
        $box.Location = [Drawing.Point]::new(20, 88)
        $box.Size = [Drawing.Size]::new(560, 24)
        $box.UseSystemPasswordChar = $true
        $box.MaxLength = 4096
        $status = [Windows.Forms.Label]::new()
        $status.Location = [Drawing.Point]::new(20, 126)
        $status.Size = [Drawing.Size]::new(560, 36)
        $status.Text = 'No key value is printed or sent anywhere by Save.'
        $save = [Windows.Forms.Button]::new()
        $save.Location = [Drawing.Point]::new(366, 180)
        $save.Size = [Drawing.Size]::new(100, 30)
        $save.Text = 'Save encrypted'
        $cancel = [Windows.Forms.Button]::new()
        $cancel.Location = [Drawing.Point]::new(480, 180)
        $cancel.Size = [Drawing.Size]::new(100, 30)
        $cancel.Text = 'Cancel'
        $cancel.DialogResult = [Windows.Forms.DialogResult]::Cancel
        $script:saved = $false
        $save.Add_Click({
            $secure = $null
            try {
                if ([string]::IsNullOrWhiteSpace($box.Text) -or $box.Text.Trim() -match '\s') {
                    $status.Text = 'Enter a non-empty API key without spaces or line breaks.'
                    return
                }
                $secure = ConvertTo-SecureString $box.Text.Trim() -AsPlainText -Force
                Save-Key $secure $secretPath
                $box.Clear()
                $script:saved = $true
                $form.DialogResult = [Windows.Forms.DialogResult]::OK
                $form.Close()
            } catch {
                $status.Text = 'Save failed. No key was printed. Check the private storage path and permissions.'
            } finally {
                if ($secure) { $secure.Dispose() }
            }
        })
        $form.Controls.AddRange(@($label, $box, $status, $save, $cancel))
        $form.AcceptButton = $save
        $form.CancelButton = $cancel
        try { [void]$form.ShowDialog() } finally { $box.Clear(); $form.Dispose() }
        if (-not $script:saved) { Write-Output 'Cancelled; no new key saved.'; exit 2 }
        Write-Output "${Name}: saved with Windows user-scoped encryption."
        exit 0
    }
}
