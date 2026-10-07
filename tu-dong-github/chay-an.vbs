' Chay cap-nhat-ngam.bat an hoan toan (khong hien cua so den) - Task Scheduler goi file nay.
Set sh = CreateObject("WScript.Shell")
thuMuc = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run "cmd /c """ & thuMuc & "\cap-nhat-ngam.bat""", 0, True
