Set shell = CreateObject("WScript.Shell")
shell.Run "lpm.exe --lock=package-lock.json", 1, True
