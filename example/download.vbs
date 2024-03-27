dim name
name = inputbox("请输入包名：", "提示")

If IsEmpty(name) Then
    Wscript.Quit
End if

Set shell = CreateObject("WScript.Shell")
shell.Run "lpm.exe --name=" & name & " --output=download", 1, True
