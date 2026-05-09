Set shell = CreateObject("WScript.Shell")
shell.Run "pu.exe --registry=http://localhost:8081/repository/npm/ --auth=admin:123456 --dir=D:/.Verdaccio -t 16", 1, True
