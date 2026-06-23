#!/usr/bin/env python
# coding: utf-8

# <a href="https://colab.research.google.com/github/mincfranc/DD_DataScience/blob/main/10_29_24_Homework_Project3_SQL_1_Chinook_project.ipynb" target="_parent"><img src="https://colab.research.google.com/assets/colab-badge.svg" alt="Open In Colab"/></a>

# # Project SQL - Chinook
# 

# #Chinook data set
# 
# See the lecture on SQLite3 using the Chinook data set to set up the software, database, and tables, as well as for the links to ancillary information about the data set.
# 

# In[1]:


# Install the sqlite package for Ubuntu
# Download the Chinook sqlite database


# In[2]:


# Install supressed and updated sqlite3 package to interact with SQLite database within Jupyter nb on Ubuntu system

get_ipython().run_line_magic('%capture', '')
get_ipython().run_line_magic('%bash', '')
apt-get update
apt-get install -y sqlite3


# In[3]:


# @title sqlite3- help

get_ipython().system('sqlite3 --help')


# In[4]:


#Download chinook.zip file by checking if it's present otherwise transfer via curl and display list without extracting.

get_ipython().run_line_magic('%bash', '')
[ -f chinook.zip ] ||
  curl -s -O https://www.sqlitetutorial.net/wp-content/uploads/2018/03/chinook.zip
unzip -l chinook.zip


# In[5]:


#Unzip program to extract files with updated versions

get_ipython().system('unzip -u chinook.zip')


# In[6]:


#Display detailed files/folders in long list format, including hidden data.

#ls: magics shell command to list contents of a directory(folder)
#-l: tells ls to display in long list
#-a: tells ls to show all files including hidden
get_ipython().system('ls -la')


# In[7]:


# Get a list of the tables in the database

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
.tables


# In[8]:


# Show the schema for the entire database

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
.schema


# ## Come up with questions about your data
# Have a look at the Entity-Relation ( ER ) diagram to help come up with questions.
# 
# * What sort of information is in this dataset?
# * How many records are there?
# * How many different countries (states, counties, cities, etc) have records in this data set?
# 
# 
# If you are stuck, here are some ideas for questions:
# - https://github.com/LucasMcL/15-sql_queries_02-chinook/blob/master/README.md
# - [Using the R language]( https://rpubs.com/enext777/636199 )
# - [Search Google]( https://www.google.com/search?q=chinook+database+questions )
# 
# 

# ## Use SQL queries to pull specific information
# 
# Do NOT pull all the data and then filter using DataFrame methods etc. Make sure and use AT LEAST 13 of the 15 SQL options listed below. (You may have to get creative and come up with more questions to ask/answer.)
# 

# In[78]:


get_ipython().run_cell_magic('script', 'sqlite3 --column --header chinook.db', "SELECT SUM(T3.num_cols) FROM ( SELECT T1.name, ( SELECT COUNT(*) FROM pragma_table_info(T1.name) ) AS num_cols FROM sqlite_master AS T1 WHERE T1.type = 'table' ) AS T3\n")


# In[79]:


get_ipython().run_cell_magic('script', 'sqlite3 --column --header chinook.db', 'SELECT COUNT(DISTINCT country)\nFROM customers;\n')


# In[9]:


#from 10_16_24_2d-sqlite3-Selects,  10_17_24_a 2f-sqlite3-chinook, 10_17_24_ x_X_2f-sqlite3-chinooK lectures


# ### Basic Queries
# 

# #### SELECT (with * and with column names)
# 

# In[10]:


# RETURN all employee info
#%%script sqlite3 --column --header chinook.db: Command used in jupyter notebooks to run external scripts. Tells nb to execute code using sqlite3 command-line tool
# %%script: Jupyter magic command
# sqlite3: specifies command-line tool to interact with SQLITE databases
# --column: tells sql3 to format output in columns
# --header: tells sql3 to include column headers in output
# chinook.db: name of sql db file to be queried

 # SELECT: keyword specifies table 'employees' from which to retrieve
 # FROM: keyword retrieves data from ALL columns in db


# In[11]:


# RETURN all employee info

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
select *
from employees
("")


# In[12]:


# RETURN all customer info

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
select *
from customers


# In[13]:


# RETURN all employee info from only the specific column names 'EmployeeID..'

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')

select EmployeeId, LastName, FirstName, Title, ReportsTo
from employees
("")


# In[14]:


# RETURN all customer info from only the specific column names 'CustomerID...'

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
select CustomerID, FirstName, LastName, SupportRepID
from customers
("")


# #### WHERE
# 

# In[15]:


#RETURN list of all customers who have SupportRep 4

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
SELECT * FROM customers
WHERE SupportRepID = '4'
("")


# #### AND
# 

# In[16]:


#RETURN list of all customers from Denmark and have SupportRep 4

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
SELECT *
FROM customers
WHERE country = 'Denmark'
AND supportrepid= '4'
("")


# #### OR
# 

# In[17]:


#RETURN all columns from customers table for records where city is either 'Brussels' or 'Buenos Aires'.
get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
SELECT *
FROM customers
WHERE city = 'Brussels'
OR city= 'Buenos Aires'
("")


# #### LIKE (with % or _ wildcard)
# 

# In[18]:


#RETURN all info from customers table whose last names end with 'a'

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
SELECT *
FROM customers
WHERE lastname LIKE '%a'
("")


# #### BETWEEN
# 

# In[19]:


#RETURN all columns from the invoices table for records with an invoicedate between January 1, 2013, and April 30, 2013

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
SELECT *
FROM invoices
WHERE invoicedate
BETWEEN '2013-01-01' AND '2013-04-30'
("")


# #### LIMIT
# 
# 

# In[20]:


#Retrieve all information for the first five genres

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
SELECT *
FROM genres
LIMIT 5
("")


# ### Sorting and Grouping
# 

# #### ORDER BY
# 

# In[21]:


#RETURN all data from invoices table sorted by values in `total` column in ascending order

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
SELECT *
FROM invoices
ORDER BY total
("")


# #### DISTINCT
# 

# In[22]:


#RETURN Unique Composer Names without duplicates

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
select distinct Composer
from tracks
Limit 10
("")


# #### GROUP BY
# 
# 

# In[23]:


#RETURN Aggregate Sales by Customer with Billing Country

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
select customerid, SUM(total) AS total_sales, billingcountry
from invoices
GROUP BY customerid
("")


# In[24]:


#RETURN total number of customers grouped by country from the customers table, displaying each country alongside its corresponding customer count

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
SELECT Country, COUNT(*) AS CustomerCount
FROM Customers
GROUP BY Country
("")


# ### Aggregates
# 

# #### MAX
# 

# In[25]:


#RETURN most recent invoice date from the invoices table

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
SELECT max(invoicedate)
FROM invoices
("")


# #### MIN
# 

# In[26]:


#RETURN earliest invoice date from the invoices table

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
SELECT min(invoicedate)
FROM invoices
("")


# #### SUM
# 

# In[27]:


#RETURN calculated total sum of all invoice amounts from invoices table

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
SELECT sum(total)
FROM invoices
("")


# #### AVG
# 

# In[28]:


#RETURN calculated average invoice amount from invoices table

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
SELECT AVG(total) FROM invoices
("")


# In[29]:


#RETURN first 10 records of invoice IDs and their corresponding invoice dates from invoices table to verify that InvoiceDate is formatted as YYYY-MM-DD

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
SELECT
    InvoiceId,
    InvoiceDate
FROM
    invoices
LIMIT 10
("")


# ## AVERAGE
# *   Business need: calculate the average number of days between invoices for each customer to enhance cash flow management, optimize marketing strategies, and improve overall customer engagement and retention.
# 
# *  Question: How do I calculate the average number of days between invoices for each customer?

#       - Use WITH clause to create CTE from invoices table, columns CustomerID & alias DaysBetw to compute
#         difference in days bt consecutive invoices
#       - Query CTE by selecting column CustomerID and averaging alias column
#       - Join CTE with customer table alias on CustomerID
#       - Filter out nulls in DaysBetw
#       - Group by CustomerID

# In[30]:


# RETURN Calculated average days between invoices for each customer

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')

WITH InvoiceDiff AS (                   --CTE "InvoiceDiff" from invoices table
    SELECT                              --col 'CustomerId' & alias 'DaysBetw'
        CustomerId,                     --calculated difference in days
        (julianday(InvoiceDate) - julianday(LAG(InvoiceDate) OVER (PARTITION BY CustomerId ORDER BY InvoiceDate))) AS DaysBetw
    FROM
        invoices
)

SELECT
    cust.CustomerId,                      --Query CTE "InvoiceDiff" by selecting
    AVG(DaysBetw) AS AvgDaysBetweenInvoices      --CustID & averaging 'DaysBetw'
FROM
    InvoiceDiff                     --Joining it w customers table alias 'cust'
JOIN                                                            --on CustomerId
    customers AS cust ON InvoiceDiff.CustomerId = cust.CustomerId
WHERE
    DaysBetw IS NOT NULL                         --Filtering out null 'DaysBetw'
GROUP BY                                           --and grouping by CustomerId
    cust.CustomerId
("")


# ```
# ** (julianday(InvoiceDate) - julianday(LAG(InvoiceDate) OVER (PARTITION BY CustomerId ORDER BY InvoiceDate))) AS DaysBetw **
# 
# This code snippet calculates the number of days between consecutive invoices for each customer using the following components:
# 
# julianday(InvoiceDate): This function converts the InvoiceDate into a Julian day number. The Julian date system is a timekeeping method that
# provides a continuous count of days from a fixed starting point. Every day which passes is assigned a unique number, eliminating complications
# related to calendar months and years.
# 
# LAG(InvoiceDate) OVER (PARTITION BY CustomerId ORDER BY InvoiceDate): The LAG function retrieves the invoice date of the previous invoice for
# the same customer (defined by CustomerId). The OVER clause specifies that this operation is partitioned by CustomerId and ordered by
# InvoiceDate, ensuring that the comparison is made with the most recent prior invoice.
# 
# (julianday(InvoiceDate) - julianday(LAG(InvoiceDate)...)): This part subtracts the Julian day number of the previous invoice date from
# the Julian day number of the current invoice date, resulting in the difference in days between the two invoices.
# 
# AS DaysBetw: This aliases the result of the calculation as DaysBetw, which represents the number of days between the current invoice and
#  the previous invoice for each customer.
# 
# Overall, this expression provides the time interval in days between consecutive invoices, allowing for further analysis of customer
#  purchasing behavior.
# ```

# In[31]:


#RETURN calculated mean average of days between invoices across all customers

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')

WITH InvoiceDiff AS (                   --Determine average days bt consecutive
    SELECT                              --invoices per customer
        CustomerId,
        (julianday(InvoiceDate) - julianday(LAG(InvoiceDate) OVER (PARTITION BY CustomerId ORDER BY InvoiceDate))) AS DaysBetw
    FROM
        invoices
), CustomerAverages AS (
    SELECT
        CustomerId,
        AVG(DaysBetw) AS AvgDaysBetweenInvoices
    FROM
        InvoiceDiff
    WHERE
        DaysBetw IS NOT NULL
    GROUP BY                            --Aggregate averages
        CustomerId
)

SELECT
    AVG(AvgDaysBetweenInvoices) AS MeanDaysBetweenInvoices
FROM
    CustomerAverages
    ("")


# #### COUNT
# 
# 

# In[32]:


#RETURN list of countries listed by customers without duplicates

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
select count(distinct country)
from customers
("")


# In[33]:


#RETURN total number of customers

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
select count(customerID)
from customers
("")


# In[34]:


get_ipython().run_cell_magic('script', 'sqlite3 --column --header chinook.db', 'select count(invoiceID)\nfrom INVOICES\n;\n')


# ## Make some plots
# 
# Make some cool plots to go with your data. Write SQL queries to get ONLY the information you need for each plot. (Don't pull ALL the data and then just plot a few columns.)
# 
# 

# ##PLOT 1
# *   Business need:  analyze the total sales generated by each employee to  enhance sales performance and inform resource allocation.
# 
# *   Question: Which employees are generating the highest total sales, and what factors contribute to their success?
# 
# *  Bar chart to plot total sales for each employee.
# 
# 
# *Answer: Jane Peacock, Margaret Park, & Steve Johnson are the top 3 employees.*
# 
# *Will look into factors at another time.*
# 

# ```
# METHOD: find x employee in employees table, find all customers associated with employee x, calculate sum of total from customer invoices
# and assign as totalsales. Repeat method for all employees. Sort results so employees with most sales shown first.
# 
# #SELECT clause gets employee data from employees table and sums total from invoices table then assigns it to alias variable totalsales
# 
# #TO GET employees table connected to invoices, must first connect employees table to customers, then connect THAT to invoices==
# 
# #FROM clause starts from employees table which LEFT JOINS employeeID with supportrepID from customers table to link employees to their
# assigned customers. Left join includes all employees even without assigned customers.
# 
# #LEFT JOIN invoices table with customers table joined previously. This extends join to include invoice data
# 
# #GROUP BY clause groups by employees data  first
# #ORDER BY clause sorts results in descending order based on totalsales
# ```

# In[35]:


#RETURN list of total sales generated by each employee, calculated as the sum of all invoice total by employee and displayed in descending order of total sales. Employee with highest sales is at top of list

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
SELECT
Employees.EmployeeId,
Employees.FirstName,
Employees.LastName,
SUM(invoices.Total) AS TotalSales

FROM Employees
LEFT JOIN customers ON EmployeeId = customers.SupportRepId
LEFT JOIN invoices ON customers.CustomerId = invoices.CustomerId
GROUP BY Employees.EmployeeId, Employees.FirstName, Employees.LastName
ORDER BY TotalSales DESC
("")


# In[36]:


#Define SQL query which finds out which employee has the highest sales, and load results into a pandas dataframe. Then run graphics on data.

# Join table 'employees' with table 'customers' via employeeID to supportRepID
# Join that output to invoices table via 'customers' customer ID to customerID
# Display sum of total column per employee
# Sort in ascending order

import pandas as pd
import sqlite3

# Connect to database
conn = sqlite3.connect('chinook.db')

# Define SQL query
query = """
SELECT
    Employees.EmployeeId,
    Employees.FirstName,
    Employees.LastName,
    SUM(invoices.Total) AS TotalSales

FROM Employees
LEFT JOIN customers ON EmployeeId = customers.SupportRepId
LEFT JOIN invoices ON customers.CustomerId = invoices.CustomerId
GROUP BY Employees.EmployeeId, Employees.FirstName, Employees.LastName
ORDER BY TotalSales DESC;
"""

# Execute query and store results in a DataFrame
df = pd.read_sql_query(query, conn)

# Close connection
conn.close()

# Now 'df' contains the data as a DataFrame
print(df.head())  # Print the first few rows to verify


# In[37]:


#Same as above but include all 8 employees even with missing values or zero dollars in sales

import pandas as pd
import sqlite3

# Connect to the database
conn = sqlite3.connect('chinook.db')

# Modified SQL query to include all employees and handle NULL sales
query = """
SELECT
    E.EmployeeId,
    E.FirstName,
    E.LastName,
    COALESCE(SUM(I.Total), 0) AS TotalSales  -- Use COALESCE to replace NULL sales with 0

FROM Employees E
LEFT JOIN customers C ON E.EmployeeId = C.SupportRepId
LEFT JOIN invoices I ON C.CustomerId = I.CustomerId
GROUP BY E.EmployeeId, E.FirstName, E.LastName
ORDER BY TotalSales DESC;
"""

# Execute query and store results in a DataFrame
df2 = pd.read_sql_query(query, conn)

# Print the head of the dataframe to verify
print(df2)

# Close the connection - Optional, good practice to add conn.close() after you are done with database operations
conn.close()


# In[38]:


#Same as above and plot in barchart

import pandas as pd
import matplotlib.pyplot as plt
import sqlite3
import numpy as np
import matplotlib.cm as cm
import seaborn as sns

# Connect to the database
conn = sqlite3.connect('chinook.db')

# SQL query (from ipython-input-162-1498ee910209)
query = """
SELECT
    E.EmployeeId,
    E.FirstName,
    E.LastName,
    COALESCE(SUM(I.Total), 0) AS TotalSales  -- Use COALESCE to replace NULL sales with 0

FROM Employees E
LEFT JOIN customers C ON E.EmployeeId = C.SupportRepId
LEFT JOIN invoices I ON C.CustomerId = I.CustomerId
GROUP BY E.EmployeeId, E.FirstName, E.LastName
ORDER BY TotalSales DESC;
"""

# Execute the query and store results in a DataFrame
df2 = pd.read_sql_query(query, conn)

# Save the DataFrame to 'output.csv'
df2.to_csv('output.csv', index=False)  # Add this line to save the data

# Close the connection
conn.close()

# Now you can read it back if needed
df2 = pd.read_csv('output.csv')


# Plot
plt.figure(figsize=(10, 6))

# Create a color palette with a unique color for each employee
colors = plt.cm.twilight_shifted(np.linspace(0, 1, len(df2)))

# Create the bar chart with different colors for each employee
plt.bar(df2['FirstName'] + ' ' + df2['LastName'], df2['TotalSales'], color=colors)
plt.title('Total Sales by Employee')
plt.xlabel('Employee')
plt.ylabel('Total Sales in Dollar Amount')
plt.xticks(rotation=45)
plt.show()


# In[ ]:


from google.colab import drive
drive.mount('/content/drive')


# In[39]:


cmaps= plt.colormaps()
print(cmaps)


# ## More Graphics: Distribution of track lengths
# 
# * Business need: analyze the distribution of track lengths across different music genres to better understand consumer preferences and trends, to enhance marketing strategies, optimize playlist curation, and guide artist development for increased listener engagement and revenue growth.
# 
# * Question:  How do I retrieve a list of tracks along with the distribution of track length across different music genres?
# 
# * Use box plot to illustrate the distribution, to show median, quartiles, and any outliers in track lengths for each genre.

# In[40]:


#RETURN counts of unique genres in genres table providing insight into the diversity of music genres available

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
select count(distinct genreid)
from genres
("")


# In[41]:


#RETURN names of music genres along with corresponding track lengths in seconds by joining the genres table and the tracks table based on the genre ID

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')

-- Get the distribution of track lengths by genre
SELECT g.Name AS genre_name, t.Milliseconds / 1000 AS track_length_seconds
FROM genres AS g
JOIN tracks AS t ON g.GenreId = t.GenreId
("")


# In[42]:


#Python code to execute query and create box plot


# Connect to database
conn = sqlite3.connect('chinook.db')

# SQL query to get track lengths by genre
query = """
SELECT g.Name AS genre_name, t.Milliseconds / 1000 AS track_length_seconds
FROM genres AS g
JOIN tracks AS t ON g.GenreId = t.GenreId
ORDER BY t.Milliseconds DESC
;
"""

# Execute query and store results in DataFrame called df_track_lengths
df_track_lengths = pd.read_sql_query(query, conn)

# Close the connection
conn.close()

# Create box plot
plt.figure(figsize=(14, 8))
sns.boxplot(
    x='genre_name',
    y='track_length_seconds',
    hue= 'genre_name',
    data=df_track_lengths, palette='Set1')
plt.xlabel('Genre')
plt.ylabel('Track Length (seconds)')
plt.title('Distribution of Track Lengths by Genre')
plt.xticks(rotation=45)
plt.grid(True)
plt.show()


# In[43]:


#Return min and max track lengths for each genre in seconds
get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
SELECT
    G.Name AS GenreName,
    MAX(T.Milliseconds/1000) AS MaxTrackLength,
    MIN(T.Milliseconds/1000) AS MinTrackLength
FROM genres AS G
JOIN tracks AS T ON G.GenreId = T.GenreId
GROUP BY G.Name
ORDER BY MaxTrackLength DESC
("")


# ###Box Plot shows various outliers.
# 
# Drop outliers to balance distribution

# In[44]:


#Remove 7 genres with highest max track lengths

# Connect to the database (use dummy_chinook.db if you created one)
conn = sqlite3.connect('chinook.db')

# SQL query to get track lengths for the remaining genres
query = """
SELECT g.Name AS genre_name, t.Milliseconds / 1000 AS track_length_seconds
FROM genres AS g
JOIN tracks AS t ON g.GenreId = t.GenreId
WHERE g.Name NOT IN ('TV Shows', 'Drama', 'Sci Fi & Fantasy', 'Science Fiction', 'Comedy', 'Rock');
"""

# Execute the query and store results in a DataFrame
df_filtered_track_lengths = pd.read_sql_query(query, conn)

# Close the connection
conn.close()

# Create the box plot using seaborn
plt.figure(figsize=(14, 8))
sns.boxplot(
    x='genre_name',
    y='track_length_seconds',
    data=df_filtered_track_lengths,
    hue= 'genre_name',
    palette='Set2'
    )
plt.xlabel('Genre')
plt.ylabel('Track Length (seconds)')
plt.title('Distribution of Track Lengths by Genre (Outliers Removed)')
plt.xticks(rotation=45, ha='right')  # Rotate x-axis labels for better readability
plt.tight_layout()  # Adjust layout to prevent labels from overlapping
plt.show()


# In[45]:


#Find avg track length in seconds for each genre
get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
SELECT g.Name AS genre_name, AVG(t.Milliseconds) / 1000 AS avg_length_seconds
FROM genres AS g
JOIN tracks AS t ON g.GenreId = t.GenreId
GROUP BY g.Name
ORDER BY avg_length_seconds DESC;


# In[46]:


# Group data by genre and get descriptive statistics
genre_stats = df_track_lengths.groupby('genre_name')['track_length_seconds'].describe().sort_values(by=['max'])

# Display the table
print(genre_stats)


# ### Explore media type for the 5 outlier genres
# 
# All the same as others genres

# In[47]:


#RETURN names of specified genres concatenated with distinct media types associated with each genre
#Joining the genres, tracks, and media_types tables, grouping the results by genre name and ordering them alphabetically

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
SELECT
    G.Name AS GenreName,
    GROUP_CONCAT(DISTINCT M.Name) AS MediaTypes
FROM genres AS G
JOIN tracks AS T ON G.GenreId = T.GenreId
JOIN media_types AS M ON T.MediaTypeId = M.MediaTypeId
WHERE
    G.Name IN ('Sci Fi & Fantasy', 'Science Fiction', 'Drama', 'TV Shows', 'Comedy')
GROUP BY G.Name
ORDER BY G.Name
("")


# In[48]:


# Create the histogram using seaborn
plt.figure(figsize=(12, 6))  # Adjust figure size if needed
sns.histplot(data=df_track_lengths, x='track_length_seconds', hue='genre_name', element='step', palette='colorblind')
plt.title('Distribution of Track Lengths by Genre')
plt.xlabel('Track Length (seconds)')
plt.ylabel('Frequency')
plt.show()


# 
# *   So overall avg of track length in seconds across 25 genres is 393 seconds
# *  5 genres avg between 1585 and 2911 seconds
#     * Sci Fi & Fantasy   2911       
#     * Science Fiction     2625         
#     * Drama               2575            
#     * TV Shows            2145         
#     * Comedy              1585
#     
# 
# remove these via CTE and plot avg track length in seconds for remaining 20 genres

# In[49]:


get_ipython().run_cell_magic('script', 'sqlite3 --column --header chinook.db', "DELETE FROM genres\nWHERE Name IN ('TV Shows', 'Drama', 'Sci Fi & Fantasy', 'Science Fiction', 'Comedy', 'Rock')\n\n")


# In[50]:


# Connect to the database
conn = sqlite3.connect('chinook.db')

# Read data into a pandas DataFrame
df_track_lengths = pd.read_sql_query("""
    SELECT T.Name AS track_name, T.Milliseconds/1000 AS track_length_seconds, G.Name AS genre_name
    FROM tracks AS T
    JOIN genres AS G ON T.GenreId = G.GenreId
""", conn)

# Close the database connection
conn.close()

# Create the histogram using seaborn
plt.figure(figsize=(12, 6))  # Adjust figure size if needed
sns.histplot(data=df_track_lengths, x='track_length_seconds', hue='genre_name', element='step', palette='deep')
plt.title('Distribution of Track Lengths by Genre')
plt.xlabel('Track Length (seconds)')
plt.ylabel('Frequency')
plt.show()


# In[51]:


#DELETE 4 additional genres beyond 600 seconds max
get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
DELETE FROM genres
WHERE Name IN ('Pop', 'Alternative', 'Jazz', 'Metal')


# In[52]:


get_ipython().run_cell_magic('script', 'sqlite3 --column --header chinook.db', 'Select name\nfrom genres\n')


# In[53]:


# Connect to the database
conn = sqlite3.connect('chinook.db')

# Read data into a pandas DataFrame
df_track_lengths = pd.read_sql_query("""
    SELECT T.Name AS track_name, T.Milliseconds/1000 AS track_length_seconds, G.Name AS genre_name
    FROM tracks AS T
    JOIN genres AS G ON T.GenreId = G.GenreId
""", conn)

# Close the database connection
conn.close()

# Create the histogram using seaborn
plt.figure(figsize=(12, 6))  # Adjust figure size if needed
sns.histplot(data=df_track_lengths, x='track_length_seconds', hue='genre_name', element='step', palette='magma')
plt.title('Distribution of Track Lengths by Genre')
plt.xlabel('Track Length (seconds)')
plt.ylabel('Frequency')
plt.show()


# In[54]:


get_ipython().run_cell_magic('script', 'sqlite3 --column --header chinook.db', '--Get average track length\nSELECT avg(Milliseconds/1000) FROM tracks;\n')


# ##  Find correlation between track length (from the tracks table) and track IDs in the invoice_items table.
# 
# *   Join tracks table with invoice items on TrackId
# *   
# *   List item
# *   List item
# 
# 
# 

# In[55]:


#RETURN a dataset containing track lengths in seconds with respective trackIDs

# Connect to the chinook database
conn = sqlite3.connect('chinook.db')

# Execute query and load results into a DataFrame
query = '''
SELECT
    t.Milliseconds / 1000.0 AS TrackLengthSeconds,
    ii.TrackId
FROM
    invoice_items AS ii
JOIN
    tracks AS t ON ii.TrackId = t.TrackId;
'''

# Create DataFrame
df3 = pd.read_sql_query(query, conn)

# Close the database connection
conn.close()


# In[56]:


#Find avg track length in seconds for each genre
get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
SELECT g.Name AS genre_name, AVG(t.Milliseconds) / 1000 AS avg_length_seconds
FROM genres AS g
JOIN tracks AS t ON g.GenreId = t.GenreId
GROUP BY g.Name
ORDER BY avg_length_seconds DESC;


# ##Correlation
# Calculate the correlation between the track lengths (in seconds) of purchased tracks and the corresponding invoice item costs.

# In[57]:


import sqlite3
import pandas as pd

# Connect to the chinook database
conn = sqlite3.connect('chinook.db')

# Query to get track lengths and invoice item costs
query = '''
SELECT
    t.TrackId,
    t.Milliseconds / 1000.0 AS TrackLengthSeconds,
    ii.UnitPrice AS InvoiceItemCost
FROM
    tracks AS t
JOIN
    invoice_items AS ii ON t.TrackId = ii.TrackId
JOIN
    invoices AS i ON ii.InvoiceId = i.InvoiceId;
'''

# Load the results into a DataFrame
df_tracks = pd.read_sql_query(query, conn)

# Close the database connection
conn.close()

# Calculate the correlation between Track Length and Invoice Item Cost
correlation = df_tracks['TrackLengthSeconds'].corr(df_tracks['InvoiceItemCost'])
print("Correlation between Track Length (in seconds) and Invoice Item Cost:", correlation)


# 
# 
# *   Correlation coefficient of 0.93 indicates a near perfect positive correlation (as one variable increases, the other also increases) -- range is -1 to 1. The closer to +/-1 the stronger the relationship.
# *   The diverging color scheme indicates the values in green are positive and perfectly correlated at 1.0, and the values in pink indicate, in this case, also positive correlations below 1.0.
# *

# In[58]:


# Connect to the chinook database
conn = sqlite3.connect('chinook.db')

# Query to get track lengths and invoice item costs
query = '''
SELECT
    t.Milliseconds / 1000.0 AS TrackLengthSeconds,
    ii.UnitPrice AS InvoiceItemCost
FROM
    tracks AS t
JOIN
    invoice_items AS ii ON t.TrackId = ii.TrackId
JOIN
    invoices AS i ON ii.InvoiceId = i.InvoiceId
WHERE
    ii.Quantity > 0;  -- Ensure only purchased items are considered
'''

# Load the results into a DataFrame
df_tracks = pd.read_sql_query(query, conn)

# Close the database connection
conn.close()

# Calculate the correlation matrix
correlation_matrix = df_tracks.corr()

# Set font properties to bold with a default font
plt.rc('font', family='Liberation Mono', weight='bold', size=12)  # Using a default sans-serif font

# Create a heatmap to visualize the correlation
plt.figure(figsize=(8, 6))
sns.heatmap(correlation_matrix, annot=True, cmap='PiYG', fmt=".2f", square=True, cbar_kws={"shrink": .8})

# Personalized titles and labels
plt.title('Correlation Heatmap of Individual Track Length & Customer Purchases',
          fontweight='bold')
plt.xlabel(' ', fontweight='bold')  # X-axis label
plt.ylabel(' ', fontweight='bold')  # Y-axis label

# Customizing tick labels
plt.xticks(ticks=[0.5, 1.5], labels=['Track Length (in seconds)', 'Customer Purchases'], rotation=45)
plt.yticks(ticks=[0.5, 1.5], labels=['Track Length (in seconds)', 'Customer Purchases'], rotation=0)

plt.show()


# ```
# The provided code performs several key tasks related to querying a database, analyzing data, and visualizing results:
# 
# ### Breakdown of the Code:
# 
# 1. **SQL Query**:
#    - The query retrieves two specific pieces of information:
#      - **Track Length**: The length of tracks in seconds, calculated by converting milliseconds (stored in the database) to seconds.
#      - **Invoice Item Cost**: The price of each item in the invoice.
#    - It joins three tables: `tracks`, `invoice_items`, and `invoices` to associate tracks with their respective purchases.
#    - The `WHERE` clause ensures that only records for items that have been purchased (where `Quantity > 0`) are included.
# 
# 2. **Loading Data**:
#    - The results of the SQL query are loaded into a Pandas DataFrame named `df_tracks`, which allows for easy data manipulation and analysis in Python.
# 
# 3. **Database Connection Management**:
#    - After loading the data, the database connection is closed to free up resources.
# 
# 4. **Correlation Calculation**:
#    - The correlation matrix is calculated from the DataFrame. This matrix shows the relationship between track lengths and invoice item costs, helping to identify any statistical correlation.
# 
# 5. **Visualization Setup**:
#    - The font settings for the plots are configured to use 'Liberation Mono' in bold, ensuring a clear presentation.
# 
# 6. **Heatmap Creation**:
#    - A heatmap is generated using Seaborn, visualizing the correlation matrix.
#    - The `annot=True` argument displays the correlation coefficients on the heatmap.
#    - The color map `coolwarm` is used to represent positive and negative correlations visually.
# 
# 7. **Personalization**:
#    - The heatmap is titled "Correlation Heatmap of Individual Track Length & Customer Purchases."
#    - The x-axis and y-axis labels are personalized but left empty for clarity.
#    - Custom tick labels are added for better understanding, indicating what each axis represents (track length and customer purchases).
# 
# 8. **Display**:
#    - Finally, `plt.show()` displays the heatmap.
# 
# ### Summary
# This code effectively retrieves and analyzes data on track lengths and invoice item costs, calculates the correlation between them, and visualizes the results in a clear and informative heatmap. The personalized titles and labels enhance readability, making it easier for viewers to interpret the correlations between individual track lengths and customer purchases.
# 

# In[59]:


import matplotlib.font_manager

# List all available fonts
available_fonts = sorted(set(f.name for f in matplotlib.font_manager.fontManager.ttflist))
print(available_fonts)


# In[59]:





# ### EXTRA CREDIT:
# * Use a CTE
# * Use a query that joins two or more tables.
# * Make a model to see if you can predict something
# * Come up with something else cool to do with your data
# 

# ###CTE

# In[60]:


#1. CTE
#Create 2 CTEs to output data about employees and customers who are linked in 2 tables.
#first CTE: EmployeesCTE is aliased 'ec', second CTE: CustomersCTE aliased 'cc'
#'ec' consists of 5 columns, 'cc' consists of 4 columns
#Condition for JOINing both CTEs is based on their link from SupportRepId to EmployeeID
#INNER JOIN will display only records/rows where supportrepid matches employeeid

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
WITH EmployeesCTE AS (
    SELECT
        EmployeeId, LastName, FirstName, Title, ReportsTo
    FROM employees
),
CustomersCTE AS (
    SELECT
        CustomerId, FirstName, LastName, SupportRepId
    FROM customers
)
SELECT
    ec.EmployeeId, ec.LastName, ec.FirstName, ec.Title, ec.ReportsTo,
    cc.CustomerId, cc.FirstName, cc.LastName
FROM CustomersCTE AS cc
INNER JOIN EmployeesCTE AS ec
ON cc.SupportRepId = ec.EmployeeId
("")


# In[61]:


#2. Query that joins two or more tables

#Business Need: identify trends in customer preferences, allowing for targeted marketing strategies. Do so by analyzing the distribution of tracks by media type.

#Question:  How can I retrieve a list of tracks along with their corresponding media types from db?

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
SELECT
    t.Name AS TrackName,
    mt.Name AS MediaType
FROM
    tracks AS t
JOIN
    media_types AS mt ON t.MediaTypeId = mt.MediaTypeId
ORDER BY
    t.Name
LIMIT 20


# ### Create a Predictive Model

# In[62]:


#3. Create a predictive model

#Business need: Predict which genres and media types will sell best to plan next album launches.

#Question: Which genres and media types should we focus on for new music releases?

#Model: A Random Forest Regressor is used to predict the total sales of tracks based on genre and media type. The model is trained on historical data from the Chinook database. RFR model does not require one-hot encoding categorical variables like genre and media type.

#Outcome: The model's performance is evaluated using the Mean Squared Error (MSE).

#This is a Supervised Regression problem bc model is trained on labeled dataset (genre, media type) with known target variable (total sales) which is a continuous numerical variable.

#STEP 1: Data extraction- Pull track details, genre, media type, and sales information from table 'tracks', aliased as t. JOIN

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')

SELECT
t.TrackId,
t.Name AS TrackName,
g.Name AS Genre,
mt.Name AS MediaType,
SUM(ii.Quantity) AS TotalSales

FROM
tracks AS t

JOIN
genres AS g ON t.GenreId = g.GenreId

JOIN
media_types AS mt ON t.MediaTypeId = mt.MediaTypeId
JOIN

invoice_items AS ii ON t.TrackId = ii.TrackId

GROUP BY
t.TrackId, g.Name, mt.Name

ORDER BY
TotalSales DESC

LIMIT 20
("")


# In[63]:


conn = sqlite3.connect('chinook.db')

# # Execute the SQL query and load data into a DataFrame
query = """
SELECT
    t.TrackId,
    t.Name AS TrackName,
    g.Name AS Genre,
    mt.Name AS MediaType,
    SUM(ii.Quantity) AS TotalSales
FROM
    tracks AS t
JOIN
    genres AS g ON t.GenreId = g.GenreId
JOIN
    media_types AS mt ON t.MediaTypeId = mt.MediaTypeId
JOIN
    invoice_items AS ii ON t.TrackId = ii.TrackId
GROUP BY
    t.TrackId, g.Name, mt.Name
ORDER BY
    TotalSales DESC
;
"""
df = pd.read_sql_query(query, conn)
conn.close()


# In[64]:


# Prepare the data for modeling:

# Encode categorical variables
df = pd.get_dummies(df, columns=['Genre', 'MediaType'], drop_first=True)

# Define features and target
X = df.drop(['TrackId', 'TrackName', 'TotalSales'], axis=1)
y = df['TotalSales']


# In[65]:


# Model Creation

# Use a machine learning model to predict total sales

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error

# Split the data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Create and train the model
model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

# Make predictions
y_pred = model.predict(X_test)

# Evaluate the model
mse = mean_squared_error(y_test, y_pred)
print(f'Mean Squared Error: {mse:.2f}')


# ```An MSE of 0.14 suggests Random Forest Regressor model is making fairly accurate predictions of total track sales based on genre and media type. ```

# In[66]:


#4. Other fun things
# Select the first 10 entries from joining the Customers and Employees tables

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
select *
from customers
join employees
on customers.SupportRepID = employees.EmployeeID
limit 10
("")


# In[67]:


#RETURN invoice with highest dollar value

get_ipython().run_line_magic('%script', 'sqlite3 --column --header chinook.db')
SELECT customerid, SUM(total) AS total_sales
FROM invoices
GROUP BY customerid
ORDER BY total_sales DESC
LIMIT 1
("")


# In[68]:


# Generate barchart with top 5 genres with most tracks.

#Method: Combine column Name from table 'genre' with column TrackId from table 'tracks', sorted by track count in descending order and displaying only 5 top genres.  Saved to a sql query to plot using matplotlib

# Connect to the database
conn = sqlite3.connect('chinook.db')
cursor = conn.cursor()

# Execute SQL query
cursor.execute("""
SELECT genres.Name AS GenreName,
       COUNT(tracks.TrackId) AS TrackCount
FROM genres
JOIN tracks ON genres.GenreId = tracks.GenreId
GROUP BY genres.GenreId
ORDER BY TrackCount DESC
LIMIT 5;
""")

# Fetch the results and create a Pandas DataFrame
genre_data = pd.DataFrame(cursor.fetchall(), columns=['GenreName', 'TrackCount'])

# Close the database connection
conn.close()

# Create the bar chart
plt.figure(figsize=(10, 6))
plt.bar(genre_data['GenreName'], genre_data['TrackCount'], color='green')
plt.title('Top 5 Genres by Number of Tracks')
plt.xlabel('Genre')
plt.ylabel('Number of Tracks')
plt.xticks(rotation=45)
plt.show()


# In[69]:


import sqlite3
import pandas as pd

# Connect to the chinook database
conn = sqlite3.connect('chinook.db')

# Execute the query and load the results into a DataFrame
query = '''
SELECT
    g.Name AS GenreName,
    SUM(ii.UnitPrice * ii.Quantity) AS TotalSpent
FROM
    genres AS g
JOIN
    tracks AS t ON g.GenreId = t.GenreId
JOIN
    invoice_items AS ii ON t.TrackId = ii.TrackId
JOIN
    invoices AS i ON ii.InvoiceId = i.InvoiceId
WHERE
    ii.Quantity > 0
GROUP BY
    g.Name
ORDER BY
    TotalSpent DESC;
'''

df_genre_spending = pd.read_sql_query(query, conn)

# Close the database connection
conn.close()

# Display the DataFrame
print(df_genre_spending)


# ##Bar chart
# Purchases are not normally distributed across genres, HOWEVER, the sales are RIGHTEOUSLY skewed as most are disproportionately Latin music sales.

# In[70]:


#RETURN bar chart wtih total moneh spent by genre
plt.figure(figsize=(12, 6))
plt.bar(df_genre_spending['GenreName'], df_genre_spending['TotalSpent'], color='skyblue')
plt.title('Total Money Spent by Genre', fontweight='bold')
plt.xlabel('Genre', fontweight='bold')
plt.ylabel('Total Spent (in dollars)', fontweight='bold')
plt.xticks(rotation=45)
plt.show()


# In[71]:


import matplotlib.pyplot as plt
import numpy as np

# Generate a list of colors
colors = plt.cm.viridis(np.linspace(0, 1, len(df_genre_spending)))

plt.figure(figsize=(12, 6))
plt.bar(df_genre_spending['GenreName'], df_genre_spending['TotalSpent'], color=colors)
plt.title('Total Money Spent by Genre', fontweight='bold')
plt.xlabel('Genre', fontweight='bold')
plt.ylabel('Total Spent (in dollars)', fontweight='bold')
plt.xticks(rotation=45)
plt.show()


# In[73]:


get_ipython().run_cell_magic('script', 'sqlite3 --column --header chinook.db', 'SELECT\n    g.Name AS GenreName,\n    SUM(ii.UnitPrice * ii.Quantity) AS TotalSpent\nFROM\n    genres AS g\nJOIN\n    tracks AS t ON g.GenreId = t.GenreId\nJOIN\n    invoice_items AS ii ON t.TrackId = ii.TrackId\nJOIN\n    invoices AS i ON ii.InvoiceId = i.InvoiceId\nWHERE\n    ii.Quantity > 0\nGROUP BY\n    g.Name\nORDER BY\n    TotalSpent DESC;\n')


# ###cannot perform ANOVA
# * TotalSpent does not follow a normal distribution, violating the assumption of ANOVA.
# * Would need to try transforming it using log transformation for example, to achieve normality but nah or I'd have to continue cleaning data and like hard pass my dude
# * TotalSpent is the variable/expression I created by calculating the aggregate amount spent on items from a specific genre per invoice.
# 
# 

# In[74]:


import statsmodels.api as sm
from statsmodels.formula.api import ols
import scipy.stats as stats
import matplotlib.pyplot as plt
import pandas as pd
import sqlite3

# Connect to the database and get the data
conn = sqlite3.connect('chinook.db')
query = '''
SELECT
    g.Name AS GenreName,
    SUM(ii.UnitPrice * ii.Quantity) AS TotalSpent
FROM
    genres AS g
JOIN
    tracks AS t ON g.GenreId = t.GenreId
JOIN
    invoice_items AS ii ON t.TrackId = ii.TrackId
JOIN
    invoices AS i ON ii.InvoiceId = i.InvoiceId
WHERE
    ii.Quantity > 0
GROUP BY
    g.Name
ORDER BY
    TotalSpent DESC;
'''
df_genre_spending = pd.read_sql_query(query, conn)
conn.close()

# --- Diagnostic Checks ---
# 1. Visual Check for Normality:
plt.hist(df_genre_spending['TotalSpent'])
plt.title('Distribution of TotalSpent')
plt.show()

# 2. Statistical Test for Normality (Shapiro-Wilk):
_, p_value = stats.shapiro(df_genre_spending['TotalSpent'])
print(f"Shapiro-Wilk Test p-value: {p_value}")

#1.903 this tells us data is not normally distributed . Again normality assumption is violated.
# If p_value < 0.05, reject normality

#ANOVA need homoscedasticity and the variance of residuals across different groups is heteroscedastic

# --- Potential Solutions ---
# If normality is violated, consider transformation:
# df_genre_spending['TotalSpent_log'] = np.log(df_genre_spending['TotalSpent']) # Log transform

# Perform ANOVA (potentially using the transformed data):
# Replace 'TotalSpent' with 'TotalSpent_log' if transformed
model = ols('TotalSpent ~ C(GenreName)', data=df_genre_spending).fit()
anova_table = sm.stats.anova_lm(model, typ=2)
print(anova_table)


# Steps to Plot SQL Query Results ( %%script sqlite3) in Jupyter Notebook/Colab using Python libraries like Matplotlib and Seaborn:
# 
# 
# 
# 1. **Set Up Your Environment:**
#    - Install necessary libraries (`pandas`, `matplotlib`, `seaborn`).
# 
# 2. **Upload Your Database File (if using Colab).**
# 
# 3. **Execute SQL Queries Using `%%script sqlite3`:**
#    - Write the SQL query and redirect output to a CSV file.
# 
# 4. **Read the Output into a Pandas DataFrame.**
# 
# 5. **Plot the Data Using Matplotlib or Seaborn.**
# 
# 6. **Repeat for Other Queries:**
#    - Write new SQL queries, output to CSV, read into DataFrames, and create plots.
# 
# 7. **Customize Your Plots.**
# 
# 8. **Save or Export Your Plots (Optional).**
