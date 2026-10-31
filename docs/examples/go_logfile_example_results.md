Pipeline Start Time: 2026-08-22 14:12:14.813
| Script ID | Return Code | Results |
| :--- | :--- | :--- |
| is_data_uptodate | 0 | DATA_UPTODATE<br>false<br><br>(1 row(s) returned)<br> |
| parse_jil_command | 0 | examples\BAT\csx_logfile_example.bat |
| find_log_in_file | 0 | examples\LOGS\csx_logfile_example.txt |
| read_log_content | 0 | {<br>  "content": "You must install or update .NET to run this application.\n\nApp: C:\\Tools\\dotnet-script.dll\nArchitecture: x64\nFramework: 'Microsoft.NETCore.App', version '8.0.0' (x64)\n.NET location: C:\\Program Files\\dotnet\\\n\nThe following frameworks were found:\n  10.0.0 at [C:\\Program Files\\dotnet\\shared\\Microsoft.NETCore.App]\n\nLearn about framework resolution:\nhttps://aka.ms/dotnet/missing-app-runtime",<br>  "timestamp": "2026-08-22T18:12:14Z",<br>  "status": "Success"<br>} |
Pipeline End Time:   2026-08-22 14:12:14.865
Pipeline Duration:   51.7472ms
