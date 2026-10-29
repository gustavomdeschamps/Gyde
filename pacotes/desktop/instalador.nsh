; Desinstalação do Gyde. O programa sai sempre; os dados da pessoa (contas, conversas, progresso, configurações e a
; chave da IA, em %APPDATA%\Gyde) só saem se ela disser que sim. Numa atualização o desinstalador da versão antiga roda
; sozinho (isUpdated) e não pergunta nem apaga nada. Na desinstalação silenciosa (/S) a resposta é "não": os dados ficam.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Apagar também os seus dados do Gyde?$\r$\n$\r$\nSão as contas, conversas, progresso da Prática, configurações e a chave da IA, guardados em:$\r$\n$APPDATA\Gyde$\r$\n$\r$\nSe escolher Não, eles continuam no computador e voltam quando você instalar o Gyde de novo." /SD IDNO IDNO manter_dados
      RMDir /r "$APPDATA\Gyde"
    manter_dados:
  ${endIf}
!macroend
