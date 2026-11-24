; 설치하기 전에: 예전(Electron) Hagisiro가 깔려 있으면 조용히 먼저 지워요
; (예전 것은 제거 정보 키 이름이 GUID이고, 새 것은 "Hagisiro"라서 서로 구분돼요. 예전 데이터 폴더는 지우지 않아서 새 위젯이 로그인 상태·위치를 이어받아요)
!macro NSIS_HOOK_PREINSTALL
  StrCpy $R0 0
  StrCpy $R4 0
  hagisiro_old_loop:
    EnumRegKey $R1 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall" $R0
    StrCmp $R1 "" hagisiro_old_done
    IntOp $R0 $R0 + 1
    StrCmp $R1 "Hagisiro" hagisiro_old_loop
    ReadRegStr $R2 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R1" "Publisher"
    StrCmp $R2 "Iruroda" 0 hagisiro_old_loop
    ReadRegStr $R3 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R1" "QuietUninstallString"
    StrCmp $R3 "" hagisiro_old_loop
    ExecWait '$R3'
    Sleep 4000 ; 예전 제거 프로그램은 임시 폴더로 옮겨 가 따로 돌기 때문에, 바로가기를 다 지울 때까지 잠깐 기다려요
    IntOp $R4 $R4 + 1
    IntCmp $R4 3 hagisiro_old_done
    StrCpy $R0 0
    Goto hagisiro_old_loop
  hagisiro_old_done:
!macroend
