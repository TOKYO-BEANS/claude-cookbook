# adobe-window.ps1: the window that adobe-session.mjs opens on the owner's screen before a
# run that sends a file or may call a tool that is not read-only. That script starts it and
# nothing else should.
#
# In:  one JSON object on standard input: title, body, go, stop, wait, seconds, arm, nonce.
# Out: one word on standard output: "go:<nonce>" (the owner clicked the go-ahead button),
#      "stop", "closed" (the window was closed without a click) or "timeout".
#
# It takes no argument, reads no file and no environment variable, and keeps nothing: a
# click is for the one run that asked. Only the mouse presses the go-ahead button: it
# answers a left mouse button let go over it, which no key raises, and it stays off for the
# first seconds. "Stop" has the focus and is the button for Enter and Esc. So a key meant
# for another window never starts a run. Any error ends it without "go".
# ASCII only: Windows PowerShell 5.1 reads a script without a byte-order mark in the system
# code page. The text to show arrives escaped (\uXXXX) for the same reason.
$ErrorActionPreference = 'Stop'
$in = [Console]::In.ReadToEnd() | ConvertFrom-Json
$seconds = [int]$in.seconds
$arm = [int]$in.arm
if ($seconds -lt 1 -or $seconds -gt 3600 -or $arm -lt 0 -or -not $in.nonce) { throw 'adobe-window: bad input' }

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$form = New-Object System.Windows.Forms.Form
$form.Text = [string]$in.title
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MinimizeBox = $false
$form.MaximizeBox = $false
$form.ShowInTaskbar = $true
$form.TopMost = $true
$form.ClientSize = New-Object System.Drawing.Size(700, 500)
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)

$box = New-Object System.Windows.Forms.TextBox
$box.Multiline = $true
$box.ReadOnly = $true
$box.WordWrap = $true
$box.ScrollBars = 'Vertical'
$box.TabStop = $false
$box.Location = New-Object System.Drawing.Point(12, 12)
$box.Size = New-Object System.Drawing.Size(676, 424)
$box.Text = [string]$in.body
$form.Controls.Add($box)

$wait = New-Object System.Windows.Forms.Label
$wait.AutoSize = $false
$wait.Location = New-Object System.Drawing.Point(12, 456)
$wait.Size = New-Object System.Drawing.Size(330, 28)
$form.Controls.Add($wait)

$stop = New-Object System.Windows.Forms.Button
$stop.Text = [string]$in.stop
$stop.Location = New-Object System.Drawing.Point(360, 450)
$stop.Size = New-Object System.Drawing.Size(158, 36)
$form.Controls.Add($stop)

$go = New-Object System.Windows.Forms.Button
$go.Text = [string]$in.go
$go.Location = New-Object System.Drawing.Point(530, 450)
$go.Size = New-Object System.Drawing.Size(158, 36)
$go.Enabled = $false
$go.TabStop = $false
$go.UseMnemonic = $false
$stop.UseMnemonic = $false
$form.Controls.Add($go)

$form.AcceptButton = $stop
$form.CancelButton = $stop

$script:answer = 'closed'
$script:left = $seconds
$script:arm = $arm
$waitText = [string]$in.wait
$wait.Text = $waitText.Replace('{s}', [string]$script:left)

$stop.Add_Click({ $script:answer = 'stop'; $form.Close() })
# Not Click: Enter, Space and a default button all raise Click on a button that has the
# focus, and the arrow keys can move the focus here. MouseUp comes from the mouse alone.
$go.Add_MouseUp({
  $left = $_.Button -eq [System.Windows.Forms.MouseButtons]::Left
  if ($go.Enabled -and $left -and $go.ClientRectangle.Contains($_.Location)) { $script:answer = 'go'; $form.Close() }
})

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 1000
$timer.Add_Tick({
  $script:left -= 1
  if ($script:arm -gt 0) { $script:arm -= 1 }
  if ($script:arm -le 0 -and -not $go.Enabled) { $go.Enabled = $true }
  $wait.Text = $waitText.Replace('{s}', [string]([Math]::Max($script:left, 0)))
  if ($script:left -le 0) { $script:answer = 'timeout'; $form.Close() }
})
$box.Select(0, 0)
$form.ActiveControl = $stop
if ($script:arm -le 0) { $go.Enabled = $true }

# The script starts this process with its console hidden, and Windows then hides the first
# showing of the process's window as well (seen on 16 November 2026: the window never
# appeared and the trial ended at its time limit). So the window is shown once, which
# Windows hides, and hidden again; the second showing, below, is the one that is seen.
$form.Show()
$form.Hide()

$timer.Start()
[void]$form.ShowDialog()
$timer.Stop()
$form.Dispose()

if ($script:answer -eq 'go') { [Console]::Out.Write('go:' + [string]$in.nonce) }
else { [Console]::Out.Write($script:answer) }
exit 0
