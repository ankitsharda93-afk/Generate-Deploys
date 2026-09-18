$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\deploy&generate.lnk")

$ChromePath1 = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$ChromePath2 = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
$ChromeExe = ""

if (Test-Path $ChromePath1) {
    $ChromeExe = $ChromePath1
} elseif (Test-Path $ChromePath2) {
    $ChromeExe = $ChromePath2
} else {
    $ChromeExe = "chrome.exe" # Fallback hoping it's in PATH, though TargetPath might need full path.
}

try {
    $Shortcut.TargetPath = $ChromeExe
    $Shortcut.Arguments = "http://localhost:3000"
    $Shortcut.IconLocation = "d:\Cloudflares\deploy_generate.ico"
    $Shortcut.Save()
    Write-Host "Success"
} catch {
    Write-Host "Error: $_"
}
