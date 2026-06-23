Python scripts set up —single venv, activate it, install packages, fix .style calls, then run the script with python Data-Science\python-scripts\Binary_Classification_Transaction.py from the activated venv.
(**insert the file name)

STEP 1 — Ensure only ONE virtual environment exists
Go to your project root: C:\Users\minef\tech-portfolio
Delete either “venv” or “.venv”. Keep only ONE.
Recommended: keep “.venv” and delete “venv”.

STEP 2 — Create the virtual environment
Open PowerShell in the project root.
Run: python -m venv .venv
Activate it: ..venv\Scripts\Activate.ps1
Your prompt must show: (.venv)

STEP 3 — Install required packages
 Run these inside the activated venv:
 python -m pip install --upgrade pip
 python -m pip install numpy pandas matplotlib seaborn scikit-learn

STEP 4 — Verify packages installed in the correct venv
 Run: python -m pip show numpy
 Location must be: C:\Users\minef\tech-portfolio.venv\Lib\site-packages

STEP 5 — Fix VS Code interpreter
Press Ctrl+Shift+P
Choose: Python: Select Interpreter
Select: ..venv\Scripts\python.exe
Bottom-right of VS Code must show: Python 3.x ('.venv')

STEP 6 — Fix VS Code settings
 Open: tech-portfolio/.vscode/settings.json
 Replace contents with:
{ "python.defaultInterpreterPath": "C:\Users\minef\tech-portfolio\.venv\Scripts\python.exe", "python.analysis.extraPaths": [ "C:\Users\minef\tech-portfolio\.venv\Lib\site-packages" ], "python.terminal.activateEnvironment": true, "python.terminal.activateEnvInCurrentTerminal": true }
Reload VS Code: Ctrl+Shift+P → Developer: Reload Window

STEP 7 — Fix all correlation matrix errors
 Search your script for: .style
 Replace every instance with:
plt.figure(figsize=(12, 10))
 sns.heatmap(corr, cmap='coolwarm', annot=False)
 plt.show()
Do this for all correlation matrices.

STEP 8 — Run your script correctly
 From the activated venv, run:
python Data-Science\python-scripts\Binary_Classification_Transaction.py

STEP 9 — Confirm everything works
 You should see:
 • No ModuleNotFoundError
 • No jinja2 error
 • No .style error
 • Heatmaps display normally
 • Script completes execution