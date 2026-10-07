@echo off
setlocal
set "MAVEN_PROJECTBASEDIR=%~dp0"
if "%MAVEN_PROJECTBASEDIR:~-1%"=="\" set "MAVEN_PROJECTBASEDIR=%MAVEN_PROJECTBASEDIR:~0,-1%"
set "WRAPPER_JAR=%MAVEN_PROJECTBASEDIR%\.mvn\wrapper\maven-wrapper.jar"
set WRAPPER_LAUNCHER=org.apache.maven.wrapper.MavenWrapperMain
if not exist "%WRAPPER_JAR%" (
  echo Maven Wrapper jar not found: %WRAPPER_JAR%
  exit /b 1
)
if "%JAVA_HOME%"=="" (
  set "JAVA_EXE=java.exe"
) else (
  set "JAVA_EXE=%JAVA_HOME%\bin\java.exe"
)
"%JAVA_EXE%" -classpath "%WRAPPER_JAR%" "-Dmaven.multiModuleProjectDirectory=%MAVEN_PROJECTBASEDIR%" %WRAPPER_LAUNCHER% %*
exit /b %ERRORLEVEL%
