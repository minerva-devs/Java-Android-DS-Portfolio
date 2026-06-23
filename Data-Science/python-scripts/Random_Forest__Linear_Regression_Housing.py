#!/usr/bin/env python
# coding: utf-8

# <a href="https://colab.research.google.com/github/mincfranc/DD_DataScience/blob/main/Project2__LinearRegression.ipynb" target="_parent"><img src="https://colab.research.google.com/assets/colab-badge.svg" alt="Open In Colab"/></a>

# # **PROJECT 2: PREDICTING HOUSE PRICES**

# # 1 Problem Definition
# 

# 
# *   **This project aims to identify the factors most strongly contributing to home sale prices.**
# 
# 
# *   **The dataset spanning from 2006 to 2010 was sourced from the Assessor's office and is labeled with 81 fields containing house characgteristics and the sales prices for 2,637 cases.**
# 
# *  **The target variable is defined and contains continuous numerical data,  making this a supervised regression problem.**

# #2 Data Collection/Sources
# 

# 
# ```
# 15 Libraries, 1 CSV file with DataFrame via URL, and 1 Data Dictionary pdf.
# 
# ```

# In[50]:


import pandas as pd
import numpy as np

import matplotlib.pyplot as plt
import seaborn as sns

import statsmodels.api as sns
from IPython.display import IFrame

from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error
from sklearn.impute import SimpleImputer

from sklearn.feature_selection import RFE
from sklearn.feature_selection import RFECV

from sklearn.linear_model import LinearRegression
from sklearn.linear_model import Ridge

from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler


# ##*a. Set up the locations of the files containing CSV data as "df"*
# *   **Data loaded from AWS S3: Housing.Data.csv**
# *  **CSV file read into a Pandas DataFrame in Python**
# *   **Assigned Dataframe variable: "df"**

# In[51]:


url = 'https://ddc-datascience.s3.amazonaws.com/Projects/Project.2-Housing/Data/Housing.Data.csv'

df= pd.read_csv(url)


# ##*b. Data Dictionary Reference*
# 
# *  **Includes e-source**
# *  **Lists all variable definitions: types & format**

# In[52]:


from IPython.display import HTML
HTML('<iframe src="https://drive.google.com/file/d/1-KTKMgT_0mhof9rzrWZBW81InX3Ol5Hp/preview" width="640" height="480" allow="autoplay"></iframe>')


# ##*c. Copy DataFrame as "df1"*
# 
# *   Preserve original DataFrame when modifying copy.
# *   Independent copy to compare to original df/
# 
# 

# In[53]:


df1 = pd.DataFrame(df)


# #3 Data Cleaning
# 

# ##*a. Understanding the Data*

# ```
# Summary of data structure: Dataset has 81 columns, 2,637 rows, with high null values and zero duplicates.
# *Inconsistent with Data Dictionary
# 
# Target variable identified as "SalePrice", "PID" as the Identifier variable and the remaining 79 columns
# are the feature variables.
# ```

# **<font color="chartreuse">.shape</font>**
# 
# *Tuple with 81 columns and 2,637 rows in dataframe.*

# In[54]:


df1.shape


# **<font color="chartreuse">.head</font>**
# 
# *Preview of first 5 rows indicating presence of null values in multiple columns and rows*

# In[55]:


df1.head()


# **<font color="chartreuse">.tail</font>**
# 
# *Preview of last five rows with same null findings as with .head method*

# In[56]:


df1.tail()


# ## *b. TARGET Variable: "SalePrice"*
# 
# **<font color="chartreuse">.info</font>**
# 
# Summary of dataframe structure indicated there are:
# *  ***Target variable "SalePrice" is integer data type***
# *   11 float columns, 27 integer columns, 43 object columns
# *   Columns with high amount of nulls to explore
# *   and Dataset is using: 1.6+ MB** memory

# In[57]:


df1.info()


# **<font color="chartreuse">.describe and .transpose</font>**
# 
# 38 numeric variables
# Renamed index label '50%' to 'median'

# In[58]:


describe_df = df1.describe()
describe_df.rename(index={'50%': 'median'}, inplace=True)
describe_df.transpose()


# **<font color="chartreuse">.duplicated</font>**
# 
# *Zero duplicates in dataset*
# 
# Zero rows with duplicate values.

# In[59]:


df1.duplicated()


# ## *c. IDENTIFIER Variable: "PID"*
# 
# **<font color="chartreuse">.nunique</font>**
# 
# 
# Search for unique values indicates Parcel identification number **(PID)** has as many unique values as there are rows
# 
# 
# Will delete from df1 as it is not necessary for data analyses

# In[60]:


df1.nunique()


# ## *d. Columns with Missing Values Only for entire df*
# 
# *   In Descending order
# *   26 Columns
# *   Plan to delete columns with high missing values to control skewed distribution
# 
# 

# In[61]:


#Get columns with missing values
columns_with_missing_values= df1.isna().sum()

missing_columns= columns_with_missing_values[columns_with_missing_values >0]
print(f"Columns with missing values=", missing_columns.count())
print(f"Total values missing from all columns=", missing_columns.sum())
print(missing_columns.sort_values(ascending=False))
print(missing_columns.dtype)



# ###Dropped columns with high nulls
# 
# *  'PID' not necessary for analyses
# *   High null count: Pool QC, Misc Feature, Alley, Fence, Mas Vnr Type, Fireplace Qu
# 
# 

# In[62]:


Dropped_cols_1 = df1.drop(['PID','Pool QC', 'Misc Feature', 'Alley', 'Fence', 'Mas Vnr Type', 'Fireplace Qu'], axis=1, inplace=True)


# In[63]:


#Confirmed Dropped_cols_1
df1.info()


# ## *e. Identify Data Type by Columns*

# #### 37 Categorical Columns & 37 Numerical Columns Identified after dropping High Null fields

# In[64]:


# Identify categorical columns
categorical_columns_df1 = df1.select_dtypes(include=['object', 'category']).columns.tolist()
print(f'Categorical columns{categorical_columns_df1}')
print(len(categorical_columns_df1))

# Identify numerical columns
numerical_columns_df1 = df1.select_dtypes(include=['int64', 'float64']).columns.tolist()
print(f'\nNumerical columns{numerical_columns_df1}')
print(len(numerical_columns_df1))


# Identify Subcategories and Value Counts in Categorical Columns

# In[65]:


print(f"Number of categorical columns= {len(categorical_columns_df1)}")
print()

total_nulls=0 #initialize

for col in categorical_columns_df1:
    subcategories = df1[col].nunique()

    string= subcategories
    print(f"\x1B[33m{col}= {string}\x1B[0m")
    print(f"Subcategory    Count")
    nulls=0

    # Get value counts and format the output
    total_sub_count =0 #Initialize
    for category, count in df1[col].value_counts().items():
        total_sub_count += count
        nulls= df1[col].isnull().sum()
        print(f"{category:<10}     {count}")  # Adjust the width (10) as needed
    string2= "Total values="
    print(f"\x1B[32m{string2} {total_sub_count: >5}\x1B[")
    string3= "Nulls="
    print(f"\x1B[36m{string3}{nulls}\x1B[")

    total_nulls+= nulls
    print()

print(f"Total Nulls= {total_nulls}")


# 11 Float Columns Identified

# In[66]:


#Define a Python list of float columns
float_columns_df1 = df1.select_dtypes(include=['float64']).columns.tolist()

print(len(float_columns_df1))
df_float= df1[float_columns_df1]

df_floats= df_float.copy()

(df_floats.describe().transpose())


# Lot Frontage had highest missing Float values.

# In[67]:


#Get float columns with missing values
float_columns_with_missing_values= df_floats.isna().sum()

missing_float_columns= float_columns_with_missing_values[float_columns_with_missing_values >0]
print(f"Float columns with missing values=", missing_float_columns.count())
print(f"Total values missing from all float columns=", missing_float_columns.sum())
print(missing_float_columns.sort_values(ascending=False))


# ### Dropped 'Lot Frontage' due to high null values
# 
# 10 Float columns remain

# In[68]:


# Remove 'Lot Frontage' column
df_float_1 = df_floats.drop('Lot Frontage', axis=1)

# Check for missing values
print(df_float_1.isnull().sum())
len(df_float_1.columns)


# 27 Integer Columns Identified

# In[69]:


#Define a Python list of integer columns
integer_columns_df1 = df1.select_dtypes(include=['int64']).columns.tolist()

print(len(integer_columns_df1))
df_integer= df1[integer_columns_df1]

df_integers= df_integer.copy()

(df_integers.describe())



# No missing values in any Integer Columns

# In[70]:


#Get integer columns with missing values
integer_columns_with_missing_values= df_integers.isna().sum()

missing_integers_columns= integer_columns_with_missing_values[integer_columns_with_missing_values >0]
print(f"Integers columns with missing values=", missing_integers_columns.count())
print(f"Integers values missing from all columns=", missing_integers_columns.sum())
print(missing_integers_columns.sort_values(ascending=False))


# #4 Exploratory Data Analysis
# 

# ## *a. Calculate Marginal Probability in Categorical Variables*
# 
# The probability of an event occurring to find potential strong predictors of house prices.
# 
# ---

# At least 90% of all houses in dataset share similarities across 13 categorial features indicating those features are less likely to have a strong influence on price variations.

# In[71]:


# Return marginal probability for categorical variables with subcategories over 90%

filtered_cats= []

for col in categorical_columns_df1:
    # Calculate marginal probabilities and filter for those over 90%
    filtered_probs = df1[col].value_counts(normalize=True) * 100
    filtered_probs1 = filtered_probs[filtered_probs > 90]

    # Sort filtered probabilities in descending order
    sorted_probs = filtered_probs1.sort_values(ascending=False)

    # Print if any subcategories meet the criteria
    if not sorted_probs.empty:
        print(f"\x1B[33m{col}:\x1B[0m")  # Print column name
        for index, value in sorted_probs.items():
            print(f"{index}: {value:.1f}%")  # Print subcategory and value
        print()  # Add a newline

    if not filtered_probs1.empty:
        filtered_cats.append(col)

print(filtered_cats)
print(len(filtered_cats))


# In[72]:


# Create list of 13 additional categorical columns to be removed after marginal prob findings
Dropped_cols_2 = filtered_cats

# Remove duplicates from the list to avoid potential errors
Dropped_cols_2 = list(dict.fromkeys(Dropped_cols_2))

# Drop the columns
df1 = df1.drop(columns=Dropped_cols_2, errors='ignore')  # errors='ignore' to prevent KeyError if a column doesn't exist

df1.info()


# ## *b. Understanding distribution and characteristics of categorical variables*

# ### Find Unique Subcategories in Categorical Columns
# 
# Mitigate challenges of high-cardinality categorical features to fit regression as machine learning model requires numerical input.
# 
# *   Find large number of unique categories in categorical columns.
# *   One-hot encoded to transform unique category to binary feature, and target imputation to replace categories with avg target value for corresponding category.

# In[73]:


# Initiate loop to iterate through each categorical column in list: 'categorical_columns_df1'

high_unique_cats= []


for col in categorical_columns_df1:

  if col in df1.columns:
    print(f"\nColumn: {col}")
    print(f"Number of unique values: {len(df1[col].unique())}")
    print(f"Most common values:")
    print(df1[col].value_counts(normalize=True).head()) #calculate frequency of each category in column

    # Check if the column has too many unique values
    if len(df1[col]) > 50:
        print(f"Warning: {col} has more than 50 unique values")

    # Check if the column is highly imbalanced
    if df1[col].value_counts(normalize=True).max() > 0.95:
        print(f"Warning: {col} is highly imbalanced")

    if not df1[col].empty:
      high_unique_cats.append(col)

print(len(high_unique_cats))  #24 total categorical columns with high cardinality


# ### One-hot encode 24 Categorical columns with high ordinality

# In[74]:


#Create copy of dataframe to test
encoded_cats= df1.copy()

encoded_cats= pd.get_dummies(encoded_cats, columns=high_unique_cats, prefix=high_unique_cats, drop_first=True)

# Now encoded_cats contains the one-hot encoded columns

# Print the info of the encoded DataFrame
encoded_cats.info()


# In[75]:


df1.info()


# ##*c. Data Visualization*

# ###Histogram to visualize distribution of variables and their relationship with 'SalePrice'.

# In[76]:


df1.hist(figsize=(20, 20))
plt.show()


# ###Line plots to track the trend of 'SalePrice' over time based on 'Year Built'

# In[77]:


import matplotlib.pyplot as plt

# Calculate average and maximum sale price by year
average_sale_price_by_year = df1.groupby('Year Built')['SalePrice'].mean()
max_sale_price_by_year = df1.groupby('Year Built')['SalePrice'].max()

# Create the plot
plt.figure(figsize=(12, 6))

# Plot average sale price
plt.plot(average_sale_price_by_year.index, average_sale_price_by_year.values, label='Average Sale Price')

# Plot max sale price
plt.plot(max_sale_price_by_year.index, max_sale_price_by_year.values, label='Max Sale Price')

# Customize the plot
plt.title('Sale Price Trends Over Time')
plt.xlabel('Year Built')
plt.ylabel('Sale Price')
plt.grid(True)
plt.legend()  # Add a legend to distinguish the lines

plt.show()


# In[78]:


df1['SalePrice'].describe()


# ###Scatter plots to illustrate the relationships between 'SalePrice' and key variables like "Overall Qual" and "Gr Liv Area".

# In[79]:


plt.figure(figsize=(10, 6))

# Plot 'Gr Liv Area' dots in red
plt.scatter(df1['Gr Liv Area'], df1['Gr Liv Area'], color='red', alpha=0.7, label='Gr Liv Area')

# Plot 'SalePrice' dots in yellow
plt.scatter(df1['Gr Liv Area'], df1['SalePrice'], color='yellow', alpha=0.7, label='SalePrice')

# Customize the plot
plt.title('Scatter Plot of Gr Liv Area vs. SalePrice')
plt.xlabel('Gr Liv Area')
plt.ylabel('SalePrice')
plt.grid(True)

# Add legend
plt.legend()

plt.show()


# In[80]:


plt.figure(figsize=(10, 6))

# Plot 'Overall Qual' dots in purple
plt.scatter(df1['Overall Qual'], df1['Overall Qual'], color='purple', alpha=0.7, label='Overall Qual')

# Plot 'SalePrice' dots in red
plt.scatter(df1['Overall Qual'], df1['SalePrice'], color='red', alpha=0.7, label='SalePrice')

# Customize the plot
plt.title('Scatter Plot of Overall Qual vs. SalePrice')
plt.xlabel('Overall Qual')
plt.ylabel('SalePrice')
plt.grid(True)

# Add legend
plt.legend()

plt.show()


# #5 Processing
# 

# ## *a. Feature Selection*

# In[81]:


#Correlation between categorical variables and target using temp variable encoded_cats= one-hot encoded categorical variables for nulls
rs = np.random.RandomState(0)
corr = encoded_cats.corr()
corr.style.background_gradient(cmap= 'tab10')


# In[82]:


encoded_cats.info()


# ### Overall Quality & Gr Living Area had highest correlation to SalePrice

# In[83]:


rs = np.random.RandomState(0)
corr = encoded_cats.corr()

# Filter to get correlations with 'sale_price' and apply conditions
sale_price_corr = corr['SalePrice']
filtered_sale_price_corr = sale_price_corr[(sale_price_corr >= 0.7) | (sale_price_corr <= -0.7)]

# Convert to a DataFrame for better styling
filtered_sale_price_corr_df = filtered_sale_price_corr.to_frame(name='Correlation')

# Display the filtered correlation
filtered_sale_price_corr_df.style.background_gradient(cmap='tab10')


# In[84]:


#correlation between floats and target

rs = np.random.RandomState(0)
corr = df_floats.corr()
corr.style.background_gradient(cmap= 'viridis')
#highest correlation between sales price and overall quality =0.80, sales price x greater living area 0.70


# ##*b. Mean Imputation of Floats*
# 
# Impute missing data in float columns by replacing them with the average value of their respective columns to processfor model training.

# In[85]:


# Replace missing values with the mean of each column
for col in df_float_1.columns:
    df_float_1[col] = df_float_1[col].fillna(df_float_1[col].mean())

# Verify that there are no more missing values/nulls
print(df_float_1.isnull().sum())


# #6 Regression Predicting Techniques to Minimize RMS percentage error

# ##*a. Ridge Regression*

# In[86]:


import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge
import numpy as np

# Assuming 'df1' is your DataFrame
X = df1[['Overall Qual', 'Gr Liv Area']]
y = df1['SalePrice']

# Split data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Feature scaling
scaler = StandardScaler()
X_train = scaler.fit_transform(X_train)
X_test = scaler.transform(X_test)

# Regularization with Ridge Regression
ridge = Ridge(alpha=1.0)  # Adjust alpha for regularization strength
ridge.fit(X_train, y_train)

# Make predictions
y_pred = ridge.predict(X_test)

# Calculate RMSPE
def rmspe(y_true, y_pred):
    return np.sqrt(np.mean(np.square(((y_true - y_pred) / y_true))))

rmspe_score = rmspe(y_test, y_pred)
print(f"RMSPE: {rmspe_score}")

print(rmspe_score*100)  #average percentage error in my predictions using these variables


# ##*b. Linear Regression*

# In[90]:


X = df1[['Overall Qual', 'Gr Liv Area']]
y = df1['SalePrice']

# Split data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Feature scaling
scaler = StandardScaler()
X_train = scaler.fit_transform(X_train)
X_test = scaler.transform(X_test)

#  Model Training (Linear Regression)
linear_reg = LinearRegression()  # Create a LinearRegression object
linear_reg.fit(X_train, y_train)  # Train the model

# Make predictions
y_pred = ridge.predict(X_test)

# Calculate RMSPE
def rmspe1(y_true, y_pred):
    """

    Args:
      y_true:
      y_pred:

    Returns:

    """
    return np.sqrt(np.mean(np.square(((y_true - y_pred) / y_true))))

rmspe_score = rmspe1(y_test, y_pred)
print(f"RMSPE: {rmspe_score}")

print(rmspe_score*100)  #average percentage error in my predictions using these variables


# In[88]:


import pickle



# Save the trained model and scaler
with open('house_price_model.pkl', 'wb') as file:
    pickle.dump(ridge, file)

with open('scaler.pkl', 'wb') as file:
    pickle.dump(scaler, file)

# Function for making predictions
def predict_house_price(overall_qual, gr_liv_area):
    """Predicts house price based on overall quality and living area."""

    # Load the model and scaler
    with open('house_price_model.pkl', 'rb') as file:
        model = pickle.load(file)
    with open('scaler.pkl', 'rb') as file:
        scaler = pickle.load(file)

    # Create input data
    input_data = [[overall_qual, gr_liv_area]]

    # Scale the input data
    scaled_input = scaler.transform(input_data)

    # Make prediction
    prediction = model.predict(scaled_input)[0]

    return prediction

# Example usage
overall_qual_input = 8  # Replace with user input
gr_liv_area_input = 1800  # Replace with user input

predicted_price = predict_house_price(overall_qual_input, gr_liv_area_input)
print(f"Predicted House Price: ${predicted_price:.2f}")


# Per RMSPE score 26%, the chosen prediciton variables 'Overall Qual' and 'Gr Liv Area', likely contributed to a reasonably accurate prediction of house prices.
# 
# However, there's still potential for improvement by exploring additional features and model refinements.

# #7 Data Visualization/Communication of Results
# 

# On average, my model's predictions using 'Overall Qual' and 'Gr Liv Area' are off by about 26% from the actual house prices.

# In[91]:


import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import pickle
from datetime import datetime

# 1. Prepare Data
X = df1[['Overall Qual', 'Gr Liv Area']]
y = df1['SalePrice']

# 2. Split Data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 3. Feature Scaling
scaler = StandardScaler()
X_train = scaler.fit_transform(X_train)
X_test = scaler.transform(X_test)

# 4. Model Training (Ridge Regression)
ridge = Ridge(alpha=1.0)  # Adjust alpha for regularization strength
ridge.fit(X_train, y_train)

# 5. Save the trained model and scaler
with open('house_price_model.pkl', 'wb') as file:
    pickle.dump(ridge, file)

with open('scaler.pkl', 'wb') as file:
    pickle.dump(scaler, file)

# 6. Function for Making Predictions
def predict_house_price2(overall_qual, gr_liv_area):
    """Predicts house price based on overall quality and living area."""
    with open('house_price_model.pkl', 'rb') as file:
        model = pickle.load(file)
    with open('scaler.pkl', 'rb') as file:
        scaler = pickle.load(file)
    input_data = [[overall_qual, gr_liv_area]]
    scaled_input = scaler.transform(input_data)
    prediction = model.predict(scaled_input)[0]
    return prediction

# 7. Function to calculate RMSPE
def rmspe2(y_true, y_pred):
    return np.sqrt(np.mean(np.square(((y_true - y_pred) / y_true))))

# Function to monitor and log performance
def monitor_performance(actual_prices, predicted_prices):
    """Calculates and logs RMSPE, and stores predictions with timestamps."""
    rmspe_score = rmspe(actual_prices, predicted_prices)
    # Create a log entry with timestamp
    log_entry = {
        'timestamp': datetime.now(),
        'rmspe': rmspe_score,
        'actual_prices': actual_prices.tolist(),  # Convert to list for JSON serialization
        'predicted_prices': predicted_prices.tolist()
    }
    # Append the log entry to a file or database (example: using a CSV file)
    log_df = pd.DataFrame([log_entry])
    log_df.to_csv('performance_log.csv', mode='a', header=False, index=False)
    print(f"RMSPE: {rmspe_score:.4f} (logged at {log_entry['timestamp']})")

# 8. Data Visualization/Communication of Results
def visualize_predictions2(y_true, y_pred):
    """Visualizes actual vs. predicted house prices."""
    plt.figure(figsize=(10, 6))

    # Plot actual prices in purple
    plt.scatter(y_true, y_true, color='purple', alpha=0.6, label='Actual Prices')

    # Plot predicted prices in green
    plt.scatter(y_true, y_pred, color='green', alpha=0.4, label='Predicted Prices')

    plt.xlabel("Actual House Prices")
    plt.ylabel("Predicted House Prices")
    plt.title("Actual vs. Predicted House Prices using Ridge Regression")

    # Add a 45-degree line for reference
    plt.plot([y_true.min(), y_true.max()], [y_true.min(), y_true.max()], 'k--', lw=2)

    # Add legend
    plt.legend()

    plt.show()

# Interpretation comment
    print("\nInterpretation of the Scatterplot:")
    print(" - Points close to the 45-degree line indicate good predictions.")
    print(" - Points far from the line represent larger prediction errors.")
    print(" - Overall pattern shows the relationship between actual and predicted prices.")

# Specific interpretation of the relationship (assuming a positive linear trend)
    print(" - The scatterplot shows a generally positive linear relationship,")
    print("   indicating that as actual house prices increase, the predicted")
    print("   house prices also tend to increase.")



# Example Usage:
# - Make predictions on the test set (since we are using df1 directly)
y_pred = ridge.predict(X_test)

# - Calculate and print RMSPE
rmspe_score = rmspe(y_test, y_pred)
print(f"RMSPE: {rmspe_score:.4f}")

# - Monitor performance (using test set for demonstration)
monitor_performance(y_test, y_pred)

# - Visualize predictions
visualize_predictions2(y_test, y_pred)


# In[93]:


# 1. Prepare Data
X = df1[['Overall Qual', 'Gr Liv Area']]
y = df1['SalePrice']

# 2. Split Data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 3. Feature Scaling
scaler = StandardScaler()
X_train = scaler.fit_transform(X_train)
X_test = scaler.transform(X_test)

# 4. Model Training (Linear Regression)
linear_reg = LinearRegression()  # Create a LinearRegression object
linear_reg.fit(X_train, y_train)  # Train the model

# 5. Save the trained model and scaler
with open('house_price_model.pkl', 'wb') as file:
    pickle.dump(ridge, file)

with open('scaler.pkl', 'wb') as file:
    pickle.dump(scaler, file)

# 6. Function for Making Predictions
def predict_house_price3(overall_qual, gr_liv_area):
    """Predicts house price based on overall quality and living area."""
    with open('house_price_model.pkl', 'rb') as file:
        model = pickle.load(file)
    with open('scaler.pkl', 'rb') as file:
        scaler = pickle.load(file)
    input_data = [[overall_qual, gr_liv_area]]
    scaled_input = scaler.transform(input_data)
    prediction = model.predict(scaled_input)[0]
    return prediction

# 7. Function to calculate RMSPE
def rmspe3(y_true, y_pred):
    return np.sqrt(np.mean(np.square(((y_true - y_pred) / y_true))))

# Function to monitor and log performance
def monitor_performance3(actual_prices, predicted_prices):
    """Calculates and logs RMSPE, and stores predictions with timestamps."""
    rmspe_score = rmspe1(actual_prices, predicted_prices)
    # Create a log entry with timestamp
    log_entry = {
        'timestamp': datetime.now(),
        'rmspe': rmspe_score,
        'actual_prices': actual_prices.tolist(),  # Convert to list for JSON serialization
        'predicted_prices': predicted_prices.tolist()
    }
    # Append the log entry to a file or database (example: using a CSV file)
    log_df = pd.DataFrame([log_entry])
    log_df.to_csv('performance_log.csv', mode='a', header=False, index=False)
    print(f"RMSPE: {rmspe_score:.4f} (logged at {log_entry['timestamp']})")

# 8. Data Visualization/Communication of Results
def visualize_predictions3(y_true, y_pred):
    """Visualizes actual vs. predicted house prices."""
    plt.figure(figsize=(10, 6))

    # Plot actual prices in lime
    plt.scatter(y_true, y_true, color='lime', alpha=0.3, label='Actual Prices')

    # Plot predicted prices in magenta
    plt.scatter(y_true, y_pred, color='magenta', alpha=0.3, label='Predicted Prices')

    plt.xlabel("Actual House Prices")
    plt.ylabel("Predicted House Prices")
    plt.title("Actual vs. Predicted House Prices using Linear Regression")

    # Add a 45-degree line for reference
    plt.plot([y_true.min(), y_true.max()], [y_true.min(), y_true.max()], 'k--', lw=2)

    # Add legend
    plt.legend()

    plt.show()

# Interpretation comment
    print("\nInterpretation of the Scatterplot:")
    print(" - Points close to the 45-degree line indicate good predictions.")
    print(" - Points far from the line represent larger prediction errors.")
    print(" - Overall pattern shows the relationship between actual and predicted prices.")

# Specific interpretation of the relationship (assuming a positive linear trend)
    print(" - The scatterplot shows a generally positive linear relationship,")
    print("   indicating that as actual house prices increase, the predicted")
    print("   house prices also tend to increase.")



# Example Usage:
# - Make predictions on the test set (since we are using df1 directly)
y_pred = ridge.predict(X_test)

# - Calculate and print RMSPE
rmspe_score = rmspe(y_test, y_pred)
print(f"RMSPE: {rmspe_score:.4f}")

# - Monitor performance (using test set for demonstration)
monitor_performance3(y_test, y_pred)

# - Visualize predictions
visualize_predictions3(y_test, y_pred)

