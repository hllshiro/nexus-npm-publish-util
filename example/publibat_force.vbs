Set shell = CreateObject("WScript.Shell")
shell.Run "lpm.exe --publish --publish-url=http://nexus.senjone.com/service/rest/v1/components?repository=npm-hosted --publish-auth=xqkj:xqkj --publish-dir=./download --force-publish", 1, True
