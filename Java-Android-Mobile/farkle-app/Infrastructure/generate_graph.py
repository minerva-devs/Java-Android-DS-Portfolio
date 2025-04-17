from graphviz import Digraph

# Create a Digraph (directed graph)
dot = Digraph(comment='GitHub Rubric2 Breakdown')

# Define the main sections
dot.node('I', 'I. Project Setup and Structure (Android Context)')
dot.node('II', 'II. Documentation (GitHub Pages)')
dot.node('III', 'III. Server-Side Implementation (Backend)')
dot.node('IV', 'IV. Client-Side Implementation (Android App)')
dot.node('V', 'V. Testing and Submission')

# Define sub-sections for each main section
dot.node('I_A', 'A. Introduction and Overview')
dot.node('I_B', 'B. Android Project Structure')
dot.node('I_C', 'C. Dependency Management')

dot.node('II_A', 'A. Project Description')
dot.node('II_B', 'B. Intended Users and User Stories')
dot.node('II_C', 'C. UML Class Diagram')
dot.node('II_D', 'D. Entity-Relationship Diagram (ERD)')
dot.node('II_E', 'E. Data Definition Language (DDL) SQL Code')

dot.node('III_A', 'A. Entity Classes')
dot.node('III_B', 'B. Repository Interfaces')
dot.node('III_C', 'C. OAuth 2.0 Resource Server')
dot.node('III_D', 'D. REST Controllers and Application Logic Services')

dot.node('IV_A', 'A. OAuth 2.0 Client (Minimal)')
dot.node('IV_B', 'B. Network Communication')

dot.node('V_A', 'A. Testing')
dot.node('V_B', 'B. Submission')

# Add edges to show hierarchy
dot.edge('I', 'I_A')
dot.edge('I', 'I_B')
dot.edge('I', 'I_C')

dot.edge('II', 'II_A')
dot.edge('II', 'II_B')
dot.edge('II', 'II_C')
dot.edge('II', 'II_D')
dot.edge('II', 'II_E')

dot.edge('III', 'III_A')
dot.edge('III', 'III_B')
dot.edge('III', 'III_C')
dot.edge('III', 'III_D')

dot.edge('IV', 'IV_A')
dot.edge('IV', 'IV_B')

dot.edge('V', 'V_A')
dot.edge('V', 'V_B')

# Render the graph to SVG file (which is compatible with GitHub)
dot.render('rubric_graph', format='svg', cleanup=True)

print("Graph has been generated as rubric_graph.svg")
