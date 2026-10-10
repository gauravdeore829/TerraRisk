@echo off
title World Bank - Climate Stress Testing Platform (FIN-01)
echo =====================================================================
echo  WORLD BANK GROUP - CLIMATE STRESS TESTING OF BANK LOAN PORTFOLIOS
echo  Problem Statement: FIN-01 (Basel III & NGFS Stress Engine)
echo =====================================================================
echo.
echo [1/2] Verifying Python environment...
python --version
echo.
echo [2/2] Starting Financial Risk Engine on http://127.0.0.1:8000 ...
echo Press Ctrl+C in this terminal window to stop the server.
echo.
python app.py
pause
