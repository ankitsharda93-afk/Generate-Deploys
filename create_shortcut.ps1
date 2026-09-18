$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\deploy&generate.lnk")
$Shortcut.TargetPath = "http://localhost:3000"
$Shortcut.IconLocation = "d:\Cloudflares\deploy_generate.ico"
$Shortcut.Save()
Write-Host "Shortcut created successfully at $DesktopPath\deploy&generate.lnk"
