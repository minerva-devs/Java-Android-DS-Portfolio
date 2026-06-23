#!/usr/bin/env python
# coding: utf-8

# <a href="https://colab.research.google.com/github/mincfranc/DD_DataScience/blob/main/Project4__Spotify_Description_for_Students.ipynb" target="_parent"><img src="https://colab.research.google.com/assets/colab-badge.svg" alt="Open In Colab"/></a>

# # Project 4: Predicting Song Popularity in Pre-release Stage Using Tree-Based Regression Models.
# 

# # Problem Definition

# The aim of Project 4 is to develop a predictive model for estimating the potential popularity of new songs prior to their release on Spotify.  
# 
# This is a supervised regression problem because we will train the model using pre-release features—such as artist followers and genre classifications—derived from existing songs. Actual popularity scores are excluded from the training process, instead focusing on how these features may indicate potential success for unreleased songs.
# 
# Objectives:
# 
# *  Identify and utilize relevant pre-release features that could indicate potential popularity.
# * Implement Decision Tree and Random Forest regression models for predictions.
# * Evaluate model performance using root mean squared error (RMSE) while minimizing overfitting through careful parameter selection.
# * Analyze feature importance to uncover which characteristics are most predictive of potential popularity.
# 
# Business need: Accurate predictions of potential popularity can enhance marketing strategies and optimize resource allocation for new music launches, contributing to the field of music analytics.

# #Data Source

# > Load libraries

# In[45]:


import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.cm as cm
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, root_mean_squared_error, r2_score
from sklearn.ensemble import RandomForestRegressor

from sklearn.preprocessing import StandardScaler
from sklearn.preprocessing import MinMaxScaler

import graphviz
from IPython.display import display
import xgboost as xgb
import pickle
import re


# > Load dataset from URL [Spotify.csv](https://ddc-datascience.s3.amazonaws.com/Projects/Project.4-Spotify/Data/Spotify.csv") into this Jupyter notebook

# In[46]:


#Use command-line tool *curl* to retrieve data without downloading dataset

url = "https://ddc-datascience.s3.amazonaws.com/Projects/Project.4-Spotify/Data/Spotify.csv"
get_ipython().system('curl -s -I {url}')


# > Dataframe: "spotify"

# In[47]:


#READ url into pandas with dataframe "spotify"

spotify= pd.read_csv(url)


# # Data Cleaning

# > Explore data

# In[48]:


#RETURN all columns with first 5 rows/records
spotify.head()


# ###Review 1

# > Review 1
# 
# * spotify df has 23 columns, 1556 rows, no nulls, categorical &  numerical data types, memory usage: 279.7+ KB
# 
# * The following columns appear likely not contributive to determining popularity of a NEW song which hasn't released hence no charting:
# 
#  "index, songID, highest charting, number times charted, week highest charting, streams, weeks charted, release date"

# In[49]:


#RETURN df structure summaries
spotify.info()


# In[50]:


#RETURN list form with all df column titles
print(spotify.columns)


# In[51]:


#RETURN basic statistics
spotify.describe()


# > Dataframe copy= "spot_1"

# In[52]:


#CREATE copy of dataframe
spot_1=spotify.copy()


# In[53]:


#Verify df was copied
spot_1.info()


# > Variable with list of columns to drop: "drop_cols_1"

# In[54]:


#CREATE list with columns to drop
drop_cols_1= ['Highest Charting Position', 'Number of Times Charted', 'Week of Highest Charting', 'Song Name', 'Streams', 'Song ID', 'Release Date', 'Weeks Charted', 'Artist']


# > Drop Columns
# 
# * New df with dropped columns: "spot_1"
#   *   14 columns,  1556 rows,  Zero nulls
# *  memory usage dropped to: 170.3+ KB (from ~280KB)
# *   used list "drop_cols_1" to drop 10 columns
# 

# In[55]:


#CREATE new df with dropped columns using "drop_cols_1"
spot_1= spot_1.drop(columns=drop_cols_1)
spot_1.info()


# In[56]:


#RETURN content from all columns for first 5 rows/records
spot_1.head()


# ###Review 2

# > Review 2
# 
# * Data types for 9 remaining columns are indicated as objects however the contents present as float.
#     *  Transform columns 3 thru 11 to floats.
# 
# * "Genre" &  "Chord" have nested values.
#     *  Parse values
# 

# > Transform Datatypes

# In[57]:


# CREATE variable with columns to be converted to float
cols_to_float = [
    'Danceability', 'Energy', 'Loudness',
    'Speechiness', 'Acousticness',
    'Liveness', 'Tempo', 'Duration (ms)',
    'Valence', 'Artist Followers', 'Popularity'
]

# Convert to float
spot_1[cols_to_float] = spot_1[cols_to_float].apply(pd.to_numeric, errors='coerce')

# Display updated DataFrame & dtypes
print("\nUpdated DataFrame:")
print(spot_1.info())


# > Handling null values
# 
# After transforming dtypes, 11 new null values presented for all 9 transformed columns.
# 
# Identify and isolate rows with missing values in a specific columns
# 
# 

# In[58]:


#Return specific location of missing values according to "Index" column

#List of specific column: "Index"
column_ind = [0]
column_ind

# Df to search for nulls in rows
find_rows = spot_1.isnull().any(axis=1)  #TRUE if null
find_rows

# Return only rows and columns with Nulls
selected= spot_1.loc[find_rows, spot_1.columns[column_ind]]

selected


# In[59]:


#compare content & datatypes from original df to new df after conversion to numerical

value = spotify.iloc[35, 9]
print(value)

print(type(value))

value2= spot_1.iloc[35, 4]
print(value2)

print(type(value2))

#original df had an empty cell misclassified as string


# > Drop 11 rows with nulls

# In[60]:


drop_rows= [35, 163, 464, 530, 636, 654, 750, 784, 876, 1140, 1538]
spot_1= spot_1.drop(index=drop_rows)
spot_1.info()


# # Feature Engineering

# Plan:
# * Determine most frequently occurring genres:  
# Extract & Explode nested Genres: separate the genres within each song and expand into individual rows, to simplify counting process.
# * Count & Identify Top 10 Genres to make dataset manageable.
# * Filter for only records with Top Genres.
# * Re-aggregate data: to keep information about all relevant genres for each song while still retaining a clean format for later analysis.
# * One-Hot Encoding for Clustering: Clustering requires a numeric format, and one-hot encoding is necessary for categorical variable "Genre". Each genre becomes a binary feature, so model recognizes genre presence across songs.

# In[61]:


# **Ensure 'Genre' column is of string type before using .str accessor**
spot_1['Genre'] = spot_1['Genre'].astype(str)

# Data preprocessing: Extract and expand genres
all_genres= spot_1['Genre'].str.split(',')
genres_expanded = spot_1.explode('Genre').reset_index(drop=True)
genres_expanded['Genre'] = genres_expanded['Genre'].astype(str).str.strip()

# Count occurrences of each genre and get the top 10 genres
top_genres = genres_expanded['Genre'].value_counts().nlargest(10).index.tolist()

# Filter data for only records containing top genres
filtered_data = genres_expanded[genres_expanded['Genre'].isin(top_genres)].copy()

# Select relevant features for pre-release prediction
X = filtered_data[['Artist Followers']]
y = filtered_data['Popularity']  # 'Popularity' is target variable

# Split the dataset into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Scale features for better performance
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# Train the Decision Tree Regressor
tree_model = DecisionTreeRegressor(max_depth=5, random_state=42)  # Adjust max_depth as needed
tree_model.fit(X_train_scaled, y_train)

# Make predictions
y_pred = tree_model.predict(X_test_scaled)

# Evaluate the model using RMSE
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
print("RMSE:", rmse)

# display feature importance
importance = tree_model.feature_importances_
feature_importance_df = pd.DataFrame({'Feature': X.columns, 'Importance': importance})
print(feature_importance_df.sort_values(by='Importance', ascending=False))

#artist followers was the only predictor i used
#look at range of popularity values to consider rmse 9.67


# In[62]:


# Plot the feature importance
plt.figure(figsize=(10, 6))
sns.barplot(x='Importance', y='Feature', data=feature_importance_df)
plt.title('Feature Importance')
plt.show()


# > Extract and Expand nested columns 'Genre' and 'Chords'

# In[63]:


spot_1.dtypes


# In[64]:


all_genres= (
 spot_1['Genre']
 .str.replace(r"['\[\]]","", regex = True)
#  .str.split(', ')
#  .explode('Genre')
#  .reset_index(drop=True)
 .str.get_dummies(sep=', ')
)
# remember you can add explode or get_dummies if you want more
# or value_counts()
all_genres


# In[65]:


spot_1["Genre"].value_counts()


# In[66]:


all_genres.shape


# In[67]:


# Count the occurrences of each genre
top_genres = all_genres.sum().nlargest(10).index.tolist()
print("Top 10 Genres:", top_genres)


# In[68]:


all_genres.sum().sort_values(ascending= False)


# In[69]:


all_genres.columns


# drop chord and genre temporarily to run decision tree regression
# pick a target and a feature

# #Feature Selection
# 
# Select features for modeling and split the data into training and test sets.

# In[70]:


# Define feature columns excluding 'Artist Followers'
features = spot_1.drop(columns=['Artist Followers'])
target = spot_1['Artist Followers']  # 'Artist Followers' is target for prediction

# Split data into training and test sets
X_train, X_test, y_train, y_test = train_test_split(features, target, test_size=0.2, random_state=42)

# Display shapes of train and test sets
print(X_train.shape, X_test.shape)


# #Model Implementation
# Implement and train the Decision Tree and Random Forest regression models

# In[71]:


numerical_features = spot_1.select_dtypes(include=['number']).columns.drop('Artist Followers')
X = spot_1[numerical_features]
y = spot_1['Artist Followers']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

decision_tree_model = DecisionTreeRegressor(random_state=42)
decision_tree_model.fit(X_train, y_train)

random_forest_model = RandomForestRegressor(random_state=42)
random_forest_model.fit(X_train, y_train)

# Make predictions
dt_predictions = decision_tree_model.predict(X_test)
rf_predictions = random_forest_model.predict(X_test)

# Calculate RMSE for both models
dt_rmse = np.sqrt(mean_squared_error(y_test, dt_predictions))
rf_rmse = np.sqrt(mean_squared_error(y_test, rf_predictions))

# Display RMSE results
print(f'Decision Tree RMSE: {dt_rmse}')
print(f'Random Forest RMSE: {rf_rmse}')

#with scaler the RMSE: 9.671977712613339
#        Feature          Importance
# 0  Artist Followers         1.0


# In[72]:


y.min(), y.max()


# #Predictions and Evaluations
# Make predictions and evaluate the models

# ##*Train Model with Pre-release Features*

# In[73]:


# Single Train-Test Split. No Scaling.

# Define predictors and target variable
predictors_2 = spot_1[['Danceability', 'Energy', 'Loudness', 'Speechiness', 'Acousticness', 'Liveness', 'Tempo', 'Duration (ms)', 'Valence', 'Artist Followers']]
target_2 = spot_1['Popularity']

X = predictors_2
y = target_2

# Split into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train decision tree regressor
tree_model = DecisionTreeRegressor(max_depth=5, random_state=42)
tree_model.fit(X_train, y_train)

# Predict and evaluate model
y_pred = tree_model.predict(X_test)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
print("RMSE:", rmse)

# Calculate feature importance
importance = tree_model.feature_importances_

# Create a DataFrame for feature importance
feature_importance_df = pd.DataFrame({'Feature': X.columns, 'Importance': importance})

# Sort by importance
feature_importance_df = feature_importance_df.sort_values(by='Importance', ascending=False)

# Display feature importance
print(feature_importance_df)

# Plot feature importance
plt.figure(figsize=(10, 6))
sns.barplot(x='Feature', y='Importance', data=feature_importance_df)#to print vertically
plt.title('Feature Importance for Popularity Prediction')
plt.xlabel('Importance')
plt.ylabel('Feature')
plt.xticks(rotation=45, ha='right')  # Rotate x-axis labels to 45 degrees
plt.show()


# ### Evaluate Performance of Decision Tree Regressor Model with Cross-Validation
# 
# CV RMSE, 5 deep:  11200.0
# 
# 3 deep: 10880.0

# In[74]:


# Cross-Validation evaluation. No scaling.

# Evaluate performance of Decision Tree Regressor model and identify the importance of different features in predicting song popularity using cross-validation for more robust estimate of the model's performance


target3 = spot_1['Popularity']
predictors3= spot_1[['Danceability', 'Energy', 'Loudness', 'Speechiness', 'Acousticness', 'Liveness', 'Tempo', 'Duration (ms)', 'Valence', 'Artist Followers']]

X = predictors3
y = target3

numLoops = 500  #number of times to repeat crossvalidation

rms_error = np.zeros(numLoops)  #array stores RMSE for each iteration in loop

for idx in range(0,numLoops):
  X_train, X_test, y_train, y_test = train_test_split(X,y,test_size=0.2) #SPLIT
  model = DecisionTreeRegressor(max_depth=3) #CREATE MODEL
  model.fit(X_train,y_train)   #TRAIN MODEL X,y
  y_pred = model.predict(X_test)   #PREDICT on TEST X,y
  rms_error[idx] = np.sqrt(mean_squared_error(y_test, y_pred)) #CALCULATE/STORE

print(f"CV RMSE: {rms_error.mean().round(2)}")


# In[75]:


#Calculate feature importance
importance3 = model.feature_importances_
importance3


# In[76]:


X.columns


# In[77]:


feature_importance_df3 = pd.DataFrame({'Feature': X.columns, 'Importance': importance3})
feature_importance_df3.sort_values(by = "Importance", ascending=False)


# In[78]:


# Sort by importance
feature_importance_df3 = feature_importance_df3.sort_values(by='Importance', ascending=False)

# Display feature importance
print(feature_importance_df3)

# Plot feature importance with rainbow colors
plt.figure(figsize=(10, 6))
num_features = len(feature_importance_df3)
colors = list(cm.rainbow(np.linspace(0, 1, num_features)))  # Convert to list
sns.barplot(x='Feature', y='Importance', data=feature_importance_df3, hue='Feature', palette=colors, dodge=False, legend=False)  # Apply rainbow colors, assign hue and set legend=False
plt.title('Feature Importance for Popularity Prediction')
plt.xlabel('Importance')
plt.ylabel('Feature')
plt.xticks(rotation=45, ha='right')
plt.show()


# In[79]:


target3.min(), target3.max()


# #Analyze importance of features for the Random Forest model

# In[80]:


# Evaluate performance of Decision Tree Regressor with scaling and cross-validation

target3 = spot_1['Popularity']
predictors3 = spot_1[['Danceability', 'Energy', 'Loudness', 'Speechiness', 'Acousticness', 'Liveness', 'Tempo', 'Duration (ms)', 'Valence', 'Artist Followers']]  # Exclude 'Genre' for scaling

X = predictors3
y = target3

numLoops = 500  # Number of times to repeat cross-validation

rms_error = np.zeros(numLoops)  # Array stores RMSE for each iteration

for idx in range(0, numLoops):
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)  # Split

    # Create and fit the scaler on the training data
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)  # Transform the test data

    model = DecisionTreeRegressor(max_depth=3)  # Create model
    model.fit(X_train_scaled, y_train)  # Train model with scaled data
    y_pred = model.predict(X_test_scaled)  # Predict on scaled test data
    rms_error[idx] = np.sqrt(mean_squared_error(y_test, y_pred))  # Calculate/store RMSE

print(f"CV RMSE: {rms_error.mean().round(2)}")

# Calculate feature importance (using the last trained model)
importance3 = model.feature_importances_

# Create a DataFrame for feature importance
feature_importance_df3 = pd.DataFrame({'Feature': X.columns, 'Importance': importance3})

# Sort by importance
feature_importance_df3 = feature_importance_df3.sort_values(by='Importance', ascending=False)

# Display feature importance
print(feature_importance_df3)

# Plot feature importance with rainbow colors
import matplotlib.cm as cm
plt.figure(figsize=(10, 6))
num_features = len(feature_importance_df3)
colors = list(cm.rainbow(np.linspace(0, 1, num_features)))  # Convert to list
sns.barplot(x='Feature', y='Importance', data=feature_importance_df3, hue='Feature', palette=colors, dodge=False, legend=False)  # Apply rainbow colors, assign hue and set legend=False
plt.title('Feature Importance for Popularity Prediction')
plt.xlabel('Importance')
plt.ylabel('Feature')
plt.xticks(rotation=45, ha='right')
plt.show()

