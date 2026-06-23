#!/usr/bin/env python
# coding: utf-8

# <a href="https://colab.research.google.com/github/mincfranc/DD_DataScience/blob/main/Project_1_.ipynb" target="_parent"><img src="https://colab.research.google.com/assets/colab-badge.svg" alt="Open In Colab"/></a>

# #**TRANSACTION DATA ANALYSIS**
# 
# 

# #1.   Project 1
# 
# ##**Problem Definition**
# 
#  Project 1 focuses on analyzing transaction data to predict customer behavior through binary classification. It aims to determine whether a future customer will make a transaction based on anonymized transaction data. The project is supervised and involves categorical outcomes using Gaussian Naive Bayes techniques to execute classification.

# #2. Data Collection
# 
# 

# **3 Libraries loaded for**  
# Data manipulation & scientific computing
import numpy as np
import pandas as pd

# Visualization
import matplotlib.pyplot as plt
import seaborn as sns

# Scikit-learn: model, metrics, evaluation, splitting
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix
)
from sklearn.model_selection import (
    cross_val_score,
    train_test_split
)
from sklearn.naive_bayes import GaussianNB

# In[ ]:

# 
# 3. Load data Train.csv from AWS.
# 
# 

# *   **Data loaded from AWS: Train.csv**
# *  **CSV file read into a Pandas DataFrame in Python**
# *   **Assigned Dataframe variable: transaction_data**
# *   **This code sets up the locations of the files containing the data**
# 
# 
# 

# In[ ]:


#Pull file for data exploration and assign its variable

url ='https://ddc-datascience.s3.amazonaws.com/Projects/Project.1-Transactions/Data/Transaction.train.csv'

transaction_data= pd.read_csv(url)


# ## Data Cleaning
# 
# 4. Examine the data using tools we have used in class.
# look at head, tail, shape
# 

# **Wide variation in range found amongst variables in dataframe head. Ex- var_1 and var_45**

# In[ ]:


#Preview first few rows for glimpse at data's structure, column names, and types of values in each column.

transaction_data.head()


# **Similar variation found amongst last entries in dataframe tail**

# In[ ]:


# Preview last few rows to compare content with head

transaction_data.tail()


# **Dataframe shape indicates 53 columns and 180,000 rows**

# In[ ]:


#Output a tuple with number of rows and columns

transaction_data.shape


# **Info shows dataframe has 50 Float columns, 2 Integer columns, and 1 Object column. Missing values not found.**

# In[ ]:


# Summary of dataframe structure

transaction_data.info()


# **Display of Count, Mean, Standard Deviation, Minimum & Maximum Value and Percentiles for each numerical column.**
# 
# **52 columns are numerical**

# In[ ]:


#Generate descriptive statistics

transaction_data.describe()


# 
# 5. If there are data cleaning issues, develop recommendations for how to deal with them.
# 
# missing values, do we assign median or mean to replace missing value
# 
# 

# **Transaction_data is a pandas DataFrame type**

# In[ ]:


# Return type of object in describe method.

type(transaction_data.describe())


# **Transaction_data copied as trans_clean to ensure changes do not affect original dataframe.**

# In[ ]:


# Create copy of dataframe Transaction_data and assign to trans_clean

trans_clean=transaction_data.copy()


# **Identify "Identifier" Variable: 'ID_Code'**
# 
# **All cells found to be unique, no duplicates**

# In[ ]:


#Return count of unique values each column contains. If a column has as many unique values as there are rows, it’s likely an identifier.

trans_clean.nunique()


# In[ ]:


for col in trans_clean.select_dtypes(include=['object', 'category']):
    print(f"{col}: {trans_clean[col].unique()}")
    print(f"Number of unique values: {trans_clean[col].nunique()}\n")


# **Columns 'Unnamed:0' and 'ID_code' unique and do not have duplicate values**

# In[ ]:


# Check for duplicates between the two unique columns.

trans_clean['Duplicate'] = trans_clean['ID_code'] == trans_clean['Unnamed: 0']
print(trans_clean['Duplicate'])


# **Identify "Target" Variable: 'target'**
# 
# 

# In[ ]:


# Return columns with binary data

binary_columns = [col for col in trans_clean.columns if trans_clean[col].nunique() == 2]

print("Potential target columns (binary):")
print(binary_columns)


# **Identify "Feature" Variables: 'var_0 through var_49'**

# In[ ]:


# Return numerical or categorical columns holding transactional details, such as transaction_amount, product_type, excluding identifier columns and target column.

feature_columns = trans_clean.drop(columns=['ID_code', 'target', 'Unnamed: 0', 'Duplicate']).columns
print(feature_columns)


# In[ ]:


# Function to identify nominal columns

def identify_nominal_columns(trans_clean):
    nominal_columns = []

    # Loop through each column to check if it's categorical
    for col in trans_clean.select_dtypes(include=['object', 'category']):
        unique_values = trans_clean[col].unique()

        # Check if the number of unique values is relatively small
        if trans_clean[col].nunique() < 10:  # Assuming nominal columns have fewer unique values
            print(f"Unique values in {col}: {unique_values}")
            print(f"Number of unique values: {trans_clean[col].nunique()}")

            # For nominal columns, we check for the absence of a clear order
            if not any(ord_val in unique_values for ord_val in ['low', 'medium', 'high']):  # Example ordinal indicators
                nominal_columns.append(col)

    return nominal_columns

# Identify nominal columns
nominal_columns = identify_nominal_columns(trans_clean)
print("Nominal Columns:", len(nominal_columns))


# In[ ]:


# Function to identify ordinal columns

def identify_ordinal_columns(trans_clean):
    ordinal_columns = []

    # Loop through each column to check if it's categorical
    for col in trans_clean.select_dtypes(include=['object', 'category']):
        unique_values = trans_clean[col].unique()

        # Check if the number of unique values is relatively small
        if trans_clean[col].nunique() < 10:  # Assuming ordinal columns have fewer unique values
            print(f"Unique values in {col}: {unique_values}")
            print(f"Number of unique values: {trans_clean[col].nunique()}")

            # Check for specific order in the values (adjust these as needed)
            if any(ord_val in unique_values for ord_val in ['low', 'medium', 'high']):
                ordinal_columns.append(col)

    return ordinal_columns

# Identify ordinal columns
ordinal_columns = identify_ordinal_columns(trans_clean)

# Output the ordinal columns and their count
print("Ordinal Columns:", len(ordinal_columns))


# In[ ]:


#Function to identify categorical columns

def classify_columns(trans_clean):
    categorical_cols = trans_clean.select_dtypes(include=['object', 'category']).columns
    ordinal_cols = []
    nominal_cols = []

    for col in categorical_cols:
        # You can customize the criteria for ordinality based on unique values
        if trans_clean[col].nunique() < 10:  # Assuming less than 10 unique values for ordinality
            print(f"Unique values in {col}: {trans_clean[col].unique()}")
            if 'low' in trans_clean[col].unique() and 'high' in trans_clean[col].unique():
                ordinal_cols.append(col)
            else:
                nominal_cols.append(col)

    return ordinal_cols, nominal_cols

ordinal_columns, nominal_columns = classify_columns(trans_clean)
print("Ordinal Columns:", len(ordinal_columns))
print("Nominal Columns:", len(nominal_columns))


# In[ ]:


# Function to identify discrete columns

def identify_discrete_columns(trans_clean):
    discrete_columns = []

    # Loop through each column in the DataFrame
    for col in trans_clean.columns:
        if pd.api.types.is_integer_dtype(trans_clean[col]):
            # If the column is of integer type, it's discrete
            discrete_columns.append(col)
        elif pd.api.types.is_object_dtype(trans_clean[col]):
            # For object type columns, check unique values
            unique_count = trans_clean[col].nunique()
            # Assuming a finite number of unique values (e.g., less than 10)
            if unique_count < 10:
                discrete_columns.append(col)

    return discrete_columns

# Identify discrete columns
discrete_columns = identify_discrete_columns(trans_clean)

# Output the discrete columns and their count
print("Discrete Columns:", discrete_columns)
print("Count of Discrete Columns:", len(discrete_columns))


# In[ ]:


# Function to identify continuous columns

def identify_continuous_columns(trans_clean):
    continuous_columns = []

    # Loop through each column in the DataFrame
    for col in trans_clean.columns:
        # Check if the column is of float type
        if pd.api.types.is_float_dtype(trans_clean[col]):
            continuous_columns.append(col)
        # Optionally include integer columns that have a high number of unique values
        elif pd.api.types.is_integer_dtype(trans_clean[col]):
            unique_count = trans_clean[col].nunique()
            # Assuming a high number of unique values indicates continuous nature
            if unique_count > 10:  # You can adjust this threshold
                continuous_columns.append(col)

    return continuous_columns

# Identify continuous columns
continuous_columns = identify_continuous_columns(trans_clean)

# Output the continuous columns and their count
print("Continuous Columns:", continuous_columns)
print("Count of Continuous Columns:", len(continuous_columns))


# In[ ]:


# Function to find duplicate rows

def find_duplicate_rows(trans_clean):
    # Find duplicate rows
    duplicates = trans_clean[trans_clean.duplicated()]

    return duplicates

# Identify duplicate rows
duplicate_rows = find_duplicate_rows(trans_clean)

# Output the duplicate rows and their count
print("Duplicate Rows:")
print(duplicate_rows)
print("Count of Duplicate Rows:", duplicate_rows.shape[0])


# In[ ]:


# Function to find rows with missing values

def find_missing_rows(trans_clean):
    # Find rows with missing values
    missing_rows = trans_clean[trans_clean.isnull().any(axis=1)]

    return missing_rows

# Identify rows with missing values
missing_rows = find_missing_rows(trans_clean)

# Output the missing rows and their count
print("Rows with Missing Values:")
print(missing_rows)
print("Count of Rows with Missing Values:", missing_rows.shape[0])


# **Dropping Columns to view relationships between target and feature columns.**

# In[ ]:


#Drop columns "Unnamed:0" & "ID_code"

trans_clean.drop("Unnamed: 0", axis = 1, inplace = True)
trans_clean.drop("ID_code", axis = 1, inplace = True)


# In[ ]:


#Drop "Duplicate" column as it does not contain feature or target data

trans_clean.drop("Duplicate", axis=1, inplace = True)


# In[ ]:


#Check dataframe for dropped columns
trans_clean.info()


# ## Exploratory Data Analysis
# 
# 6. Produce some visual analysis of the data – like plots showing the distributions of all variables. Recall that Gaussian Naive Bayes assumes the predictors are normally distributed. Note: you might have to do multiple plots in groups.
# 
# 
# 

# **Histograms conducted to visually inspect if criteria of normal distribution is met for Gaussian Naive Bayes model**
# 
# **Outputs indicate data distributions are not normal for most variables**

# In[ ]:


#Return histogram for every column

trans_clean.hist(figsize=(20, 20))
plt.show()


# **Correlations conducted to find relationships between target and feature variables**
# 
# **The square matrix output indicate zero relationships between target variable and feature variables**

# In[ ]:


#Return correlation matrix for target and feature columns.

rs = np.random.RandomState(0)
corr = trans_clean.corr()
plt.figure(figsize=(12, 10))
sns.heatmap(corr, cmap='coolwarm', annot=False)
plt.show()

# corr.style.background_gradient(cmap= 'coolwarm')


# 
# 7. NOTE: the ‘target’ column indicates a successful transaction (‘1’) or a no-transaction (‘0’). Verify these are the only values in that column.
# 

# **'target' column contains only 2 values:**
# 
# *   **0= No Transaction**
# *   **1= Successful Transaction**
# 
# **Distribution is disproportionate between two values**

# In[ ]:


#Return all values in column 'target' and response count

trans_clean['target'].value_counts()


# In[ ]:


# 18040/161960*100


# 8. Check the correlation values between all **predictor columns** to ensure there are no substantial correlations between predictors. This is important to support the decision to classify the ‘target’ using Naïve Bayes.
# 

# **Correlations between all predictor columns indicate zero relationship amongst all predictors**

# In[ ]:


#Return correlation matrix for all predictor columns

predictors = trans_clean.drop(columns=['target'])
correlation_matrix = predictors.corr()

plt.figure(figsize=(12, 10))
sns.heatmap(correlation_matrix, cmap='coolwarm', annot=False)
plt.show()


# 9. Create two data frames: one with all successful transactions, one with all unsuccessful transactions. **Make sure they are copies and not slices**.

# **2 Separate dataframes were created as copies from 'trans_clean' df:**
# 
# *   **Df 1: 'Successful' contains all rows with successful transactions**
# *  **Df 2: 'Unsuccessful'contains all rows with No Transaction**

# In[ ]:


#Return dataframe split into two separate copies of trans_clean df

Successful= trans_clean[trans_clean['target']==1].copy()
Unsuccessful= trans_clean[trans_clean['target']==0].copy()


# **Verify each new dataframe copy contains only its designated values**

# In[ ]:


#Return dataframe value contents and counts

print(Successful['target'].value_counts())
print(Unsuccessful['target'].value_counts())


# In[ ]:


#Return count difference
#161960-18040


# ## Data Processing
# 
# 10. Create two data frames: one with all the predictor columns (everything except for Unnamed: 0, ID_code and target) and one with just the target. Make sure they are copies and not slices.
# 

# **2 Additional separate dataframes were created as copies from 'trans_clean' df:
# 
# *  **Df 1: 'Predictor' contains all columns except 'target' column**
# *  **Df 2: 'Target'contains only 'target' column**
# 
# 
# 
# 

# In[ ]:


#Return dataframe split into two separate copies of trans_clean df

Predictor= trans_clean.drop(columns=['target']).copy()
Target= trans_clean['target'].copy()


# 
# 11. Define a Gaussian Naïve Bayes model using Sklearn.
# 

# **To create Gaussian Naive Bayes model object:**
# 
# * **Imported 4 sklearn libraries**
# * **Dataset was loaded into Pandas**
# 
# * **Copied features (X) and target (y) to avoid modifying originals**  
# * **Defined the Gaussian Naïve Bayes model**
# 
# 
# 
# 

# In[ ]:


# Create a Gaussian Naive Bayes model object
# Dataset loaded into a Pandas DataFrame= transaction_data = pd.read_csv(url)


y= Target.copy()
X= Predictor.copy()

gnb= GaussianNB()


# 
# 12. Divide the two data frames you created in step #10 into training and testing subsets.

# **Divided 2 dataframes from step#10 into:**
# 
# **Training Set (X_train, y_train): used by model to learn patterns and relationships between input features (X_train) and target variable (y_train).**
# 
# **Testing Set (X_test, y_test): used to evaluate model's performance after training by comparing the model's predictions (y_pred) with the actual target values (y_test).**

# In[ ]:


# Return split data into training and testing sets

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=0)


# 13. Train the model using the training subset of the dataset.

# In[ ]:


# Fit model to training data

gnb.fit(X_train, y_train)


# 
# 14. Test the model using the testing subset of the dataset. Calculate and report the accuracy.
# 

# In[ ]:


# Make predictions on the test set

y_pred = gnb.predict(X_test)


# *   **Accuracy score is 0.91 meaning 91% of predictions made by the model were correct**
# *   **In spite of High Accuracy overall, the dataset is imbalanced**
# *  **Per Classification Report while all metrics are high for "No Transaction" class,**
# *   **Precision and recall for the minority class "Transaction" are notably low**
# 

# In[ ]:


# Evaluate the model
from sklearn.metrics import classification_report

accuracy = accuracy_score(y_test, y_pred)
print(f"Accuracy: {accuracy:.2f}")

print(classification_report(y_test, y_pred))


# 15. Perform a cross-validation loop to calculate the accuracy of your model. Report that accuracy. How does it compare to the accuracy you calculated in #14?

# **To perform cross-validation loop to calculate accuracy of my model:**
# 
# *   **Imported 3 libraries and Utilized y, X variables**
# *   **Initialized GNB model in Q. 11 and Performed 5-fold cross-validation on dataset**
# *   **Mean accuracy from cross validation: 0.91 is similar to accuracy rate in Q. 14: 0.91**
# *   ****
# 
# 
# 
# 

# In[ ]:


# Return cross-validation loop to calculate model accuracy


y = Target.copy()  # Target variable
X = Predictor.copy()  # Feature variables

cv_scores = cross_val_score(gnb, X, y, cv=5)

print(f"Cross-validation scores: {cv_scores}")
print(f"Mean accuracy: {cv_scores.mean():.2f}")
print(f"Standard deviation: {cv_scores.std():.2f}")


# In[ ]:


#Another way to calculate model accuracy with cross-validation loop
y = Target.copy()  # Target variable
X = Predictor.copy()

results = cross_val_score(gnb, X, y, scoring='accuracy', cv = 10)
acc = results.mean()



# 16. Plot a histogram of the accuracy scores you generated in your cross-validation loop. What do you notice about the distribution of accuracy scores?
# 

# **Plotted histogram of the accuracy scores from cross validation loop by:**
# 
# *   **Using matplotlib to visualize histograms**
# *   **Histogram outputs show the distribution of the accuracy scores appears normalized.
# 
# 

# In[ ]:


# Return histogram of accuracy scores from cross-validation loop

feature_names = X.columns
if len(feature_names) < 4:
    raise ValueError("The dataset should contain at least 4 feature columns.")

fig, axs = plt.subplots(nrows=2, ncols=2, figsize=(8, 10))
colors = ['red', 'green', 'yellow', 'blue']  # Colors for the histograms
n = 0

for i in range(2):
    for j in range(2):
        column = feature_names[n]  # Get the feature name
        axs[i, j].hist(X[column], color=colors[n], bins=30)  # Create histogram
        axs[i, j].set_xlabel(column)  # Set x-axis label
        axs[i, j].set_title(f'Histogram of {column}')  # Set title for clarity
        n += 1

plt.tight_layout()
plt.show()


# 17.  Present the confusion matrix and the results of your Classification Report (sklearn.metrics.classification_report). What do you notice?

# **Results of my Classification Report and Confusion matrix**
# 
# *   **The model predicted the majority of No Transaction cases correctly (31,936 true negatives) with 92% Precision.**
# *    **Whereas the model correctly predicted 781 transactions (true positives), but missed 442 real transactions, predicting No Transaction (false negatives) with only 64% Precision for identifying transactions, and 22% Recall.**
# *   **Indicating the data collected at hand is not sufficient to help predict actual Transactions**
# *   **Exploring other variables not in dataset and identifying better predictors would be helpful in increasing sales**

# In[ ]:


#Return confusion matrix and results of Classification Report


y = trans_clean['target'].copy()  # Target variable
X = trans_clean.drop('target', axis=1)  # Predictor variables


# # Fit the model
gnb.fit(X_train, y_train)
predicted_y = gnb.predict(X_test)

#Generate the confusion matrix using confusion_matrix function, comparing true labels (y_test) and predicted labels (predicted_y).
mat = confusion_matrix(y_test, predicted_y)

# Plot confusion matrix
plt.figure(figsize=(8, 8))

# pyright: ignore[reportArgumentType]
sns.heatmap(mat.T,  # Transpose the confusion matrix
            square=True,
            annot=True,  # Show the numbers in the squares
            fmt='d',  # Format for annotations
            cbar=False,
            xticklabels=['No Transaction', 'Transaction'],  # Adjust labels based on your target classes # type: ignore
            yticklabels=['No Transaction', 'Transaction'])  # pyright: ignore[reportArgumentType] # Adjust labels based on your target classes
        
plt.xlabel('True Label')
plt.ylabel('Predicted Label')
plt.title('Confusion Matrix Heatmap')
plt.show()


# True Positive: model correctly predicted 31936 cases would result in No Transaction
# False Positive: model incorrectly predicted 2841 cases would result in Transaction however they resulted in No Transaction
# False Negative: model incorrectly predicted 442 cases would result in No  Transaction however they resulted in a Transaction
# True Negative: model correctly predicted 781 cases would result in a Transaction


# In[ ]:


print((442/781)*100)
print((1-442/781)*100)
print ((442/(442+781))*100)


# In[ ]:


# # Calculate classification accuracy
accuracy = accuracy_score(y_test, predicted_y)

# Print the accuracy
print(f'Classification Accuracy: {accuracy:.2f}')

#when I played around with the axes labels, the data output was wrong.


# In[ ]:


import sklearn.model_selection as model_selection

# 'trans_clean' is dataset and 'target' is the column I'm predicting
X = trans_clean.drop('target', axis=1)  # Features (all columns except target)
y = trans_clean['target']  # Target (the actual values you're predicting)

# Splitting the data into training and testing sets (80% train, 20% test)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=0)


# In[ ]:


# Generate classification report
report = classification_report(y_test, y_pred, target_names=['No Transaction', 'Transaction'])

# Print the classification report
print("Classification Report:\n")
print(report)


# In[ ]:


# Precision: Measures how many of the predicted positives are actual positives. (TP / (TP + FP))
# Recall (Sensitivity): Measures how many actual positives are correctly predicted/identified. (TP / (TP + FN))
# F1-score: The harmonic mean/balance between precision and recall.
# Support: The number of occurrences/true instances of each class.


# In[ ]:


#The model predicted the majority of No Transaction cases correctly (31,936 true negatives) with 92% Precision.
# Whereas the model correctly predicted 781 transactions (true positives), but missed 442 real transactions, predicting no transaction for them (false negatives) with only 64% Precision for identifying transactions, and 22% Recall.
#Indicating the data collected at hand is not sufficient to help predict actual Transactions. Exploring other variables not in dataset and identifying better predictors would be helpful in increasing sales.


# In[ ]:


X_train.shape


# In[ ]:


y_train.shape


# In[ ]:


X_test.shape


# In[ ]:


y_test.shape


# 
# 18. The training data is very skewed towards non-successful transactions (about 90% of the training data has ‘target’==0). Remove enough non-successful transaction rows so that your remaining training data is 50%/50% split between successful and non-successful transactions. Hint: you can use the data frames you created in step #9.

# **Created new data set with even number of cases: t_set_new**
# 
# **18040 total**

# In[ ]:


#Return new data set with 50/50 split b/t success & unsuccessful transactions

t_set = trans_clean.copy()

t_set_zeroes = t_set[t_set['target'] == 0]
t_set_ones = t_set[t_set['target'] == 1]

number_to_remove = 143920

t_set_zeroes_reduced = t_set_zeroes.sample(len(t_set_zeroes) - number_to_remove)

t_set_new = pd.concat([t_set_zeroes_reduced, t_set_ones], ignore_index = True)


# In[ ]:


#Verify 50/50 split
t_set_new['target'].value_counts()


# 
# 19. Repeat the cross-validation process on this data set. Report what your cross-validation accuracy is in this 50/50 case.

# In[ ]:


# Return cross validation accuracy for 50/50 split df

Predictor_1= t_set_new.drop(columns=['target']).copy()

Target_1= t_set_new['target'].copy()


# **Mean accuracy from cross validation for 50/50 Split df is 0.76**

# In[ ]:


#Return cross validation accuracy for 50/50 split df

from sklearn import datasets, metrics, model_selection
from sklearn import model_selection
from sklearn.model_selection import cross_val_score
from sklearn.metrics import confusion_matrix

y = Target_1.copy()  # Target variable
X = Predictor_1.copy()  # Feature variables

gnb = GaussianNB()

cv_scores = cross_val_score(gnb, X, y, cv=5)

print(f"Cross-validation scores: {cv_scores}")
print(f"Mean accuracy: {cv_scores.mean():.2f}")
print(f"Standard deviation: {cv_scores.std():.2f}")


# In[ ]:


y = Target_1.copy()  # Target variable
X = Predictor_1.copy()

results = cross_val_score(gnb, X, y, scoring='accuracy', cv = 10)
acc = results.mean()


#Mean accuracy is 0.76 for 50/50 split


# **Fit GNB model to 50/50 Data Split df**
# 
# **Output indicates 75% of model predictions were correct in determining if a customer would make a transaction**

# In[ ]:


from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import GaussianNB

y = Target_1.copy()
X = Predictor_1.copy()

# Train-test split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=0)

# Model instantiation and fitting
gnb = GaussianNB()
gnb.fit(X_train, y_train)

# Making predictions
y_pred = gnb.predict(X_test)

# Calculating accuracy
accuracy_rate = accuracy_score(y_test, y_pred)

# Printing the accuracy
print(f"Accuracy Rate: {accuracy_rate:.2f}")

# Dynamic statement based on actual accuracy
if accuracy_rate >= 0.75:
    print(f"{accuracy_rate*100:.0f}% of predictions were correct in determining if a customer would make a transaction.")
else:
    print(f"The model has an accuracy of {accuracy_rate*100:.0f}%.")


# ## Data Visualization
# 
# 
# 20. Compare the results of your cross-validation with the whole training data and the reduced 50/50 training data
# 

# 
# **Cross validation results of whole training data and reduced 50/50 training data indicate nearly identical accuracies**
# 
# 
# *   **Whole training data accuracy: 0.9112166666666666**
# *   **Reduced training data accuracy: 0.9116777777777777**
# 
# 

# In[ ]:


#Return results from cross validation of whole training data and 50/50 split data

from sklearn.naive_bayes import GaussianNB

X = trans_clean.drop('target', axis=1)
y = trans_clean['target']

gnb = GaussianNB()

# 1. Cross-validate on the whole dataset
whole_data_results = cross_val_score(gnb, X, y, cv=10, scoring='accuracy')
whole_data_mean_accuracy = whole_data_results.mean()
print(f"Cross-validation accuracy on whole training data: {whole_data_mean_accuracy}")

# 2. Create a reduced 50/50 dataset by using train_test_split to split 50% of the data
Predictor_1, _, Target_1, _ = train_test_split(X, y, test_size=0.5, random_state=0)

# 3. Cross-validate on the reduced 50/50 data set
t_set_new_results = cross_val_score(gnb, Predictor_1, Target_1, cv=10, scoring='accuracy')
t_set_new_mean_accuracy = t_set_new_results.mean()
print(f"Cross-validation accuracy on 50/50 t_set_new data: {t_set_new_mean_accuracy}")

# 4. Compare the results
print("\nComparison of accuracies:")
print(f"Whole training data accuracy: {whole_data_mean_accuracy}")
print(f"Reduced training data accuracy: {t_set_new_mean_accuracy}")


# 
# 21. Present the confusion matrix and the results of your Classification Report (sklearn.metrics.classification_report)
# 

# In[ ]:


# Confusion matrix and results of Classification Report
y = t_set_new['target'].copy()  # Target variable
X = t_set_new.drop('target', axis=1)  # Predictor variables


gnb.fit(X_train, y_train)

predicted_y = gnb.predict(X_test)

mat = confusion_matrix(y_test, predicted_y)

plt.figure(figsize=(8, 8))
sns.heatmap(mat.T,  # Transpose the confusion matrix
            square=True,
            annot=True,  # Show the numbers in the squares
            fmt='d',  # Format for annotations
            cbar=False,
            xticklabels=['No Transaction', 'Transaction'], # pyright: ignore[reportArgumentType]
            yticklabels=['No Transaction', 'Transaction']) # pyright: ignore[reportArgumentType]

plt.xlabel('True Label')
plt.ylabel('Predicted Label')
plt.title('Confusion Matrix Heatmap')
plt.show()


# In[ ]:


import sklearn.model_selection as model_selection

# 'trans_clean' is dataset and 'target' is the column I'm predicting
X = t_set_new.drop('target', axis=1)  # Features (all columns except target)
y = t_set_new['target']  # Target (the actual values you're predicting)

# Splitting the data into training and testing sets (80% train, 20% test)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=0)

# Generate classification report
report = classification_report(y_test, y_pred, target_names=['No Transaction', 'Transaction'])

# Print the classification report
print("Classification Report:\n")
print(report)


# ## Communicate the Results
# 
# 22. Communicate the results of your analysis.
# 
# 

# ###**ANALYSIS**    
#       *See Accuracy Comparison Table below*
# 
# *   **No Transaction: precision, recall, and F1-score for "No Transaction" class are significantly higher in Whole Dataset (92% precision, 99% recall) compared to 50/50 Split (75% precision, 75% recall). Showing GaussianNB identified "No Transaction" cases correctly and captured nearly all actual instances.**
# 
# * **Transaction: precision for "Transaction" class is lower in Whole Dataset (64% vs. 75%), and the recall is worse (22% vs. 75%). Meaning that the model's precision in predicting "Transactions" is better than actually identifying the "Transaction" case.**
# 
# *   **F1-score for "No Transaction" is better in Whole Dataset (0.95) than in 50/50 Split (0.75) which again shows better aptitude in this class.**
# 
# *   **However, F1-score for "Transaction" class in Whole Dataset (0.32) is significantly lower than in 50/50 Split (0.75), indicating the model is challenged when identifying "Transaction".**
# 
# *   **Overall accuracy is much higher in Whole Dataset (0.91 vs 0.75). This can be easily attributed to the disproportionately high cases in "No Transaction" class.**
# 
# * **50/50 Split has a balanced class performance with similar results for both classes on account of our data manipulation to even the cases.**
# 
# 
# *   **Whole Dataset reveals class imbalance, where the model performs very well for "No Transaction" and not for "Transaction." Support is higher as well which will affect all other metrics.**
# 
# 
# ###   **Conclusion:**
# 
# 
# *   **CNB Strengths: It is excellent at predicting "No Transaction," which might be beneficial in scenarios where identifying this class is critical.**
# *   **CNB Weaknesses: It struggles in identifying "Transaction" class, indicating it leads to missed opportunities where sales are concerned.**
# 
# 
# ###**Next Steps: Find other techniques to balance the sample in order for  the model to improve identification of "Transactions" and maybe rethink variable selection.**
# 
# 

# In[ ]:


# # ACCURACY COMPARISON TABLE

#                         Metric  Whole_data  50/50 Split
# 0                     Accuracy        0.91         0.75
# 1    F1-Score (No Transaction)        0.95         0.75
# 2       F1-Score (Transaction)        0.32         0.75
# 3           Macro Avg F1-Score        0.64         0.75
# 4          Macro Avg Precision        0.78         0.75
# 5             Macro Avg Recall        0.60         0.75
# 6   Precision (No Transaction)        0.92         0.75
# 7      Precision (Transaction)        0.64         0.75
# 8      Recall (No Transaction)        0.99         0.75
# 9         Recall (Transaction)        0.22         0.75
# 10    Support (No Transaction)    32378.00      3599.00
# 11       Support (Transaction)     3622.00      3617.00
# 12       Weighted Avg F1-Score        0.89         0.75
# 13      Weighted Avg Precision        0.89         0.75
# 14         Weighted Avg Recall        0.91         0.75


# In[ ]:


import pandas as pd

# Data for Report 1
trans_clean = {
    'Metric': [
        'Precision (No Transaction)',
        'Recall (No Transaction)',
        'F1-Score (No Transaction)',
        'Support (No Transaction)',
        'Precision (Transaction)',
        'Recall (Transaction)',
        'F1-Score (Transaction)',
        'Support (Transaction)',
        'Accuracy',
        'Macro Avg Precision',
        'Macro Avg Recall',
        'Macro Avg F1-Score',
        'Weighted Avg Precision',
        'Weighted Avg Recall',
        'Weighted Avg F1-Score'
    ],
    'Whole_data': [
        0.92,  # Precision (No Transaction)
        0.99,  # Recall (No Transaction)
        0.95,  # F1-Score (No Transaction)
        32378,  # Support (No Transaction)
        0.64,  # Precision (Transaction)
        0.22,  # Recall (Transaction)
        0.32,  # F1-Score (Transaction)
        3622,   # Support (Transaction)
        0.91,  # Accuracy
        0.78,  # Macro Avg Precision
        0.60,  # Macro Avg Recall
        0.64,  # Macro Avg F1-Score
        0.89,  # Weighted Avg Precision
        0.91,  # Weighted Avg Recall
        0.89   # Weighted Avg F1-Score
    ]
}

# Data for Report 2
t_set_new = {
    'Metric': [
        'Precision (No Transaction)',
        'Recall (No Transaction)',
        'F1-Score (No Transaction)',
        'Support (No Transaction)',
        'Precision (Transaction)',
        'Recall (Transaction)',
        'F1-Score (Transaction)',
        'Support (Transaction)',
        'Accuracy',
        'Macro Avg Precision',
        'Macro Avg Recall',
        'Macro Avg F1-Score',
        'Weighted Avg Precision',
        'Weighted Avg Recall',
        'Weighted Avg F1-Score'
    ],
    '50/50 Split': [
        0.75,  # Precision (No Transaction)
        0.75,  # Recall (No Transaction)
        0.75,  # F1-Score (No Transaction)
        3599,   # Support (No Transaction)
        0.75,  # Precision (Transaction)
        0.75,  # Recall (Transaction)
        0.75,  # F1-Score (Transaction)
        3617,   # Support (Transaction)
        0.75,  # Accuracy
        0.75,  # Macro Avg Precision
        0.75,  # Macro Avg Recall
        0.75,  # Macro Avg F1-Score
        0.75,  # Weighted Avg Precision
        0.75,  # Weighted Avg Recall
        0.75   # Weighted Avg F1-Score
    ]
}


# Creating DataFrames
df_report_1 = pd.DataFrame(trans_clean)
df_report_2 = pd.DataFrame(t_set_new)

# Merging the DataFrames for comparison
comparison_df = pd.merge(df_report_1, df_report_2, on='Metric', how='outer')
comparison_df = comparison_df.rename(columns={'Report 1': 'Report 1', 'Report 2': 'Report 2'})

# Displaying the comparison table
print(comparison_df)


# ## Submit Final Project
# 
# 23. Upload your finished Jupyter notebook to your Project 1 student folder.
# 
