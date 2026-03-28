If you get connect failed denied access error for agents.pem file then run these commands in PowerShell:


PS C:\WINDOWS\system32> icacls "C:\Users\Ayush\Downloads\agents.pem" /reset
processed file: C:\Users\Ayush\Downloads\agents.pem
Successfully processed 1 files; Failed processing 0 files
PS C:\WINDOWS\system32> icacls "C:\Users\Ayush\Downloads\agents.pem" /grant:r Ayush:F
processed file: C:\Users\Ayush\Downloads\agents.pem
Successfully processed 1 files; Failed processing 0 files
PS C:\WINDOWS\system32> icacls "C:\Users\Ayush\Downloads\agents.pem" /inheritance:r
processed file: C:\Users\Ayush\Downloads\agents.pem
Successfully processed 1 files; Failed processing 0 files
PS C:\WINDOWS\system32> icacls "C:\Users\Ayush\Downloads\agents.pem"
C:\Users\Ayush\Downloads\agents.pem DESKTOP-121L480\Ayush:(F)

Successfully processed 1 files; Failed processing 0 files