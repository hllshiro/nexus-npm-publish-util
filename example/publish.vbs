Set shell = CreateObject("WScript.Shell")
shell.Run "pu.exe --url=http://localhost:8081/service/rest/v1/components?repository=npm --auth=admin:123456 --dir=D:/.Verdaccio", 1, True
