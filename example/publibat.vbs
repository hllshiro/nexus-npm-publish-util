Set shell = CreateObject("WScript.Shell")
shell.Run "pu.exe --url=http://nexus.senjone.com/service/rest/v1/components?repository=npm-hosted --auth=xqkj:xqkj --dir=./download", 1, True
