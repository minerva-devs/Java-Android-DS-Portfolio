#!/usr/bin/env python
# coding: utf-8

# <a href="https://colab.research.google.com/github/mincfranc/DD_DataScience/blob/main/Project6_MinervaFranco.ipynb" target="_parent"><img src="https://colab.research.google.com/assets/colab-badge.svg" alt="Open In Colab"/></a>

# #Project 6

# # 1) Problem Definition

# ---
# * This problem is a supervised, binary classification task using a convolutional neural network (CNN) to classify images of cats and dogs. The CNN will be trained on labeled image data (images of cats and dogs) to predict the category of new, unseen images.
# 
# * The task highlights the use of deep learning to automate feature extraction and solve a traditionally challenging computer vision problem.
# 
# ---

# # 2) Imports

# In[1]:


# Data manipulation
import pandas as pd
import numpy as np

# Image handling
import matplotlib.pyplot as plt
from PIL import Image  # image processing

# Deep learning
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.preprocessing.image import load_img, img_to_array
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import Dense, Flatten, Conv2D, MaxPooling2D, Input
from tensorflow.keras.utils import plot_model


# Data splitting
from sklearn.model_selection import train_test_split

# Data collection & storage
import pickle  # serializing data/models
import requests  # handling image URLs or downloads
import io
from io import BytesIO
import cv2  # advanced image manipulation


# # 3) Data Collection
# 

# ---
# * Downloaded pickled datasets from AWS S3 bucket using curl & load to memory.
# 
# ---

# In[2]:


#Resources
url_X = 'https://ddc-datascience.s3.amazonaws.com/Projects/Project.6-Images/Data/X.pickle' #Feature Set:pickled dataset with raw images
url_y = 'https://ddc-datascience.s3.amazonaws.com/Projects/Project.6-Images/Data/y.pickle' #Target Set:pickled dataset of labels indicating whether image is a cat or dog
url_dog = "https://ddc-datascience.s3.amazonaws.com/Projects/Project.6-Images/Data/dog.jpg" #Test Image: single image to validate trained model


# In[3]:


get_ipython().system('curl -O {url_X}  #Linux shell command to download file from internet')


# In[4]:


get_ipython().system('curl -O {url_y}')


# In[5]:


data_X = pd.read_pickle(url_X)
data_y = np.array(pd.read_pickle(url_y))


# # 4) Data Cleaning
# 

# ---
# * Normalized image data X/255 to scale pixel values so they fall in range between 0 and 1.
# 
# * To speed up learning process & ensure model handles inputs more effectively.
# 
# ---
# 
# 

# In[6]:


#Normalize pixel values
Xscaled = data_X / 255
Xscaled


# In[7]:


#Get scaled data shape
print(Xscaled.shape)
""" Number of rows in dataset: 24946, Size of images: 100 x 100 pixels, Color scheme: Grayscale"""


# In[8]:


y_srs = pd.Series(data_y)
print(y_srs.head())


# # 5) Exploratory Data Analysis

# ---  
# * X is 4D numpy array with dimensions: (24946, 100, 100, 1)
# 
#     [num_samples, height, width, channels]
# 
# * y is 1D numpy array with dimensions: (24946)
# 
#      and labels (0= dog, 1= cat)
# 
# ---
# 
# 

# In[9]:


# Return shape of X and y, ensuring X is 4 dimensional.
print(f"X shape: {data_X.shape}")
print(f"y shape: {data_y.shape}")


# In[10]:


# Confirm data shapes
print(f"X type: {type(data_X)}")
print(f"y type: {type(data_y)}")


# * Plot a few ( >5 ) of the images in X using plt.imshow().

# In[11]:


print(plt.imshow(Xscaled[11555])) # Image display: dog
print(data_y[11555]) # Code: 0


# In[12]:


print(plt.imshow(Xscaled[8277])) #Image display: dog
print(data_y[8277]) # Code: 0


# In[13]:


print(plt.imshow(Xscaled[2071])) #Image display: cat
print(data_y[2071]) # Code: 1


# In[14]:


print(plt.imshow(Xscaled[23488]))
print(data_y[23488])


# In[15]:


print(plt.imshow(Xscaled[927]))
print(data_y[927])


# In[16]:


for c in range(444,485,10):
  plt.figure()
  plt.imshow(Xscaled[c])
  plt.title(data_y[c])
  plt.show


# In[17]:


# Sample Subset Selection for Demonstration
subset_size = int(0.1 * len(Xscaled))
random_indices = np.random.choice(Xscaled.shape[0], size=subset_size, replace=False)

# Generate random indices
X_sub = Xscaled[random_indices]
y_sub = data_y[random_indices]


# In[18]:


for c in range(444,485,10):
  plt.figure()
  plt.imshow(X_sub[c])
  plt.title(y_sub[c])
  plt.show


# # 6) Data Processing

# ---
# * Split X and y into training and testing sets using a 75/25 split ratio
# 
# ---

# In[19]:


# Split data sets for training vs testing. 75%/25% split
X_train, X_test, y_train, y_test = train_test_split(X_sub, y_sub, test_size = 0.25, random_state = 37)


# In[20]:


# Display shape of training and testing sets
print(X_sub.shape)    # Sample sets
print(y_sub.shape)

print(X_train.shape)  # Training & Testing X sets
print(X_test.shape)

print(y_train.shape)  # Training and Testing y sets
print(y_test.shape)


# # 7) Model Definition

# ---
# * Defined a convolutional neural network (CNN)using Keras Sequential API:
#   * Sequential layers
#   * Input Layer: Accepts images with shape (100, 100, 1).
#   * Convolutional Layers: 3 Conv2D layers with ReLU activations, and (3,3) kernel size.
#   * MaxPooling2D Layer: After each convolutional layer, reduces spatial dimensions, pool size of (2,2).
#   * Flatten Layer: Converts 2D output from  convolutional layers to a 1D vector.
#   * Dense Output Layer: A final layer with a single unit and sigmoid activation to output a probability (for binary classification).
# 
# ---

# In[21]:


model = Sequential()


# In[22]:


# Define input layer using Input
model.add(Input(shape = X_train.shape[1:]))  # Get input shape from X_train


# In[23]:


#Define input layer
model.add(
  Conv2D(
    name = "conv_input",
    filters = 8,
    kernel_size = (3,3),
    activation = 'relu',
  )
)

model.add(
    MaxPooling2D(pool_size=(2,2))
)


# In[24]:


# Define second hidden layer
model.add(
  Conv2D(
    name = "hidden1",
    filters = 16,
    kernel_size = (3,3),
    activation = 'relu',
  )
)

model.add(
  MaxPooling2D(pool_size=(2,2))
)


# In[25]:


# Define third hidden layer-- to improve/decrease loss
model.add(
  Conv2D(
    name = "hidden2",
    filters = 32,
    kernel_size = (3,3),
    activation = 'relu',
    )
)

model.add(
  MaxPooling2D(pool_size=(2,2))
)


# In[26]:


# Flatten data to be used in output layer
model.add(
    Flatten()
)

# Define output layer
model.add(
  Dense(
    name = "output",
    units = 1,
    activation = 'sigmoid'
  )
)


# # 8) Model Compilation

# ---
# 
# * Compiled CNN
#   * Optimizer: adam, to adjust weights based on gradient descent.
#   * Loss Function: binary_crossentropy for binary classification & a few runs of binary_focus_crossentropy.
#   * Metric: accuracy, to tracks percentage of correct predictions.
# 
# ---

# In[27]:


# Compile model
model.compile(
  optimizer = 'adam',  # Model learns using algorithm updating weights of neural network during training
  loss = 'binary_crossentropy', #Uses function measuring difference between predicted probabilities & true labels to predict cat or dog
  metrics = ['accuracy'], # Measures model's performance by its accuracy in making predictions (% correctly classified examples)
)


# #  9) Model Fit: Training x Validation Set

# ---
# * Trained Model on X_train & y_train data for 12 epochs, & with X_test and y_test used for validation.
# * The training and validation accuracy are plotted over the epochs.
# 
# ---

# In[28]:


# Train the model with validation data  with `history` as variable storing model's training history
history = model.fit(X_train, y_train, epochs=12, validation_data=(X_test, y_test))


# In[29]:


# Plot training & validation accuracy

train_accuracy = history.history['accuracy']  # Training accuracy
val_accuracy = history.history['val_accuracy']  # Validation accuracy

# Plotting training & validation accuracy
plt.figure(figsize=(10, 6))
plt.plot(train_accuracy, label='Training Accuracy', color='blue', linestyle='-', linewidth=2)
plt.plot(val_accuracy, label='Validation Accuracy', color='orange', linestyle='--', linewidth=2)

# Labels and title
plt.title('Training and Validation Accuracy over Epochs', fontsize=14)
plt.xlabel('Epochs', fontsize=12)
plt.ylabel('Accuracy', fontsize=12)

# Add a legend
plt.legend()

# Show the plot
plt.grid(True)
plt.show()


# In[30]:


model.summary()


# # 10) Evaluation

# ---
# * After training, evaluated model on testing set (X_test, y_test).
# 
# * The loss and accuracy values are printed.
# 
# ---

# In[31]:


# Evaluate the model on the validation set (X_test and y_test)
val_loss, val_accuracy = model.evaluate(X_test, y_test)

# Output the evaluation results
print(f"Validation Loss: {val_loss:.4f}")
print(f"Validation Accuracy: {val_accuracy:.4f}")


# In[32]:


# Plot training and validation accuracy
plt.plot(history.history['accuracy'], label='Training Accuracy', color='blue')
plt.plot(history.history['val_accuracy'], label='Validation Accuracy', color='orange')
plt.title('Training and Validation Accuracy')
plt.xlabel('Epochs')
plt.ylabel('Accuracy')
plt.legend()
plt.show()

# Plot training and validation loss
plt.plot(history.history['loss'], label='Training Loss', color='blue')
plt.plot(history.history['val_loss'], label='Validation Loss', color='orange')
plt.title('Training and Validation Loss')
plt.xlabel('Epochs')
plt.ylabel('Loss')
plt.legend()
plt.show()


# # 11) Model Visualization

# ---
# * Visualized model architecture using graphical representation of the model's layers.
# 
# ---

# In[33]:


plot_model(model, to_file='modelP6_1.png', show_shapes=True, show_layer_names=True)


# # 12) Prediction Distribution
# 

# ---
# * Predictions made on test set.
# * Plotted probability distribution of predictions visualizing how well the model distinguishes between cats & dogs.
# ---

# In[34]:


# Get predictions on test set
predictions = model.predict(X_test)


# In[35]:


# Flatten the predictions array to make it 1D
probabilities = predictions.flatten()

# Set a threshold to separate binary classes
threshold = 0.5

# Separate probabilities into 2 categories: values closer to 0 (class 0) and values closer to 1 (class 1)
class_0_probs = probabilities[probabilities < threshold]
class_1_probs = probabilities[probabilities >= threshold]

# Plot distribution of probabilities
plt.figure(figsize=(8, 6))

# Plot class 0 (probabilities closer to 0) in yellow
plt.hist(class_0_probs, bins=50, edgecolor='black', alpha=0.7, color='yellow', label='Class 0 (Dog)', linewidth=1.5)

# Plot class 1 (probabilities closer to 1) in magenta
plt.hist(class_1_probs, bins=50, edgecolor='black', alpha=0.7, color='magenta', label='Class 1 (Cat)', linewidth=1.5)

# Title, labels, & legend
plt.title('Distribution of Prediction Probabilities for Test Set')
plt.xlabel('Predicted Probability')
plt.ylabel('Frequency')
plt.grid(True)

# Legend
plt.legend(loc='upper right')

# Save plot to file
plt.savefig('my_plot.png')

# Show the plot
plt.show()


# In[36]:


predictions.shape


# # 13) Image Preprocessing for New Images

# ---
# * Defined function to read new image, resize, convert to grayscale, and reshape into a 4D array for model prediction.
# 
# ---

# In[37]:


print("Model Input Shape:", model.input_shape)


# In[38]:


def read_and_process_image(image_url):
    """
    Reads an image from the URL, resizes it to (100, 100),
    converts it to grayscale (mode 'L'), and formats it as a 4D array.
    """
    # Fetch and open the image
    image = Image.open(io.BytesIO(requests.get(image_url).content))

    # Resize the image to 100x100
    image = image.resize((100, 100))

    # Convert the image to grayscale
    image = image.convert('L')

    # Convert the image to a numpy array
    image_array = np.array(image)

    # Normalize pixel values to be between 0 and 1
    image_array = image_array / 255.0

    # Reshape to 4D array: (1, 100, 100, 1) for a single grayscale image
    image_array = image_array.reshape((1, 100, 100, 1))

    return image_array


# ---
# * Use the function defined above to read in the dog.jpg image that is saved in the AWS S3 bucket.
# ---
# 

# In[39]:


# Process the test image
test_img = read_and_process_image(url_dog)

# Print the shape of the processed image & confirm it's (1, 100, 100, 3)
print("Processed test image shape:", test_img.shape)
print("Processed image array:\n", test_img)


# ---
# * Use the neural network you created to predict whether the image is a dog or a cat.
# ---

# In[40]:


# Use the model to make a prediction
prediction = model.predict(test_img)

# Interpret the prediction
if prediction[0][0] < 0.5:
    prediction_label = "Dog"
else:
    prediction_label = "Cat"

# Display the processed image with the predicted label as the title
plt.imshow(test_img[0, :, :, 0], cmap='gray')  # Accessing the 2D image data directly
plt.title(f"Predicted: {prediction_label} (Probability: {prediction[0][0]:.4f})")
plt.axis('off')  # Turn off axis labels
plt.show()

# Output the prediction for verification
print(f"Prediction probability: {prediction[0][0]:.4f}")
print(f"The image is predicted to be a: {prediction_label}")


# In[41]:


#'true_label' (0 for Dog, 1 for Cat)
true_label = 0  # Replace with actual true label for the test image

# Evaluate accuracy (for this image check if prediction matches true label)
if prediction_label == "Dog":
    predicted_class = 0
else:
    predicted_class = 1

# Compare predicted class to true label
accuracy = (predicted_class == true_label)

print(f"Accuracy: {accuracy * 100:.2f}%")


# In[42]:


# Define the true label for the test image (dog image in this case)
image_label = np.array([0])  # 0 represents dog, assuming dog is labeled as 0

# Evaluate the model on a single image (dog image in this case)
image_loss, image_accuracy = model.evaluate(test_img, image_label)  # test_label should be the true label for the image (e.g., 0 for Dog)

# Output test_loss and test_accuracy for the dog image
print(f"Test Loss for Dog Image: {image_loss:.4f}")
print(f"Test Accuracy for Dog Image: {image_accuracy:.4f}")



# # Communication of Results

# ---
# **1. Problem Definition**:
# - **Task**: Binary classification of images as **Cats (label=1)** or **Dogs (label=0)**.
# - **Subset Sampling**:
#   - A **10% subset** of the original data (\(24,946 \times 0.1\)) was selected randomly for demonstration purposes.
#   - **Subset Size**: **2,494 images** (from the original \(100 \times 100\) grayscale data).
# 
# ---
# 
# **2. Dataset Statistics**:
# - **Training/Testing Split**:
#   - **Training set**: **1,870 samples**.
#   - **Testing set**: **624 samples** (75/25 split using `train_test_split`).
#   - **Subset (X_sub)**:
#     - Shape: \( (2494, 100, 100, 1) \) (2,494 images, each of size \(100 \times 100\) with 1 channel).
#     - Labels (y_sub) shape: \( (2494,) \) (1D array of labels).
# 
# - **Training Set (X_train)**:
#   - Shape: \( (1870, 100, 100, 1) \) (1,870 images for training).
#   - Labels (y_train) shape: \( (1870,) \) (1D array of labels).
# 
# - **Testing Set (X_test)**:
#   - Shape: \( (624, 100, 100, 1) \) (624 images for testing).
#   - Labels (y_test) shape: \( (624,) \) (1D array of labels).
# 
# ---
# 
# **3. Model Training and Performance**:
# - Models trained for **8-15 epochs** using **Adam optimizer** and **binary cross-entropy loss** on the sampled subset.
# - **Key Training Results**:
#   - **Run 1**:
#     - Training accuracy: **81.12%**.
#     - Validation accuracy: **71.15%**.
#     - Validation loss: **0.5762**.
#   - **Run 5**:
#     - Training accuracy: **67.94%**.
#     - Validation accuracy: **66.13%**.
#     - Validation loss: **0.1500**.
#   - **Run 10**:
#     - Training accuracy: **67.39%**.
#     - Validation accuracy: **67.47%**.
#     - Validation loss: **0.6022**.
# 
# ---
# 
# **4. Single Image Prediction**:
# - **Test Image**: An unseen dog image from AWS S3.
# - **Model Output**:
#   - Prediction probability: **0.0992**.
#   - Classification: **Dog (label=0)**.
#   - **Accuracy for this image**: **100.00%**.
# 
# ---
# 
# **5. Training Challenges**:
# - **Validation Accuracy Plateau**:
#   - Example from Run 9:
#     - Validation accuracy peaked at **69.33%** after **12 epochs**.
#     - Validation loss fluctuated between **0.5739** and **0.8229** across runs.
# - **Overfitting**:
#   - Training accuracy often exceeded validation accuracy (e.g., Run 5: **67.94% training vs. 66.13% validation**).
# 
# ---
# 
# **6. Key Observations from Experiments**:
# - **Filter and Layer Variations**:
#   - Increasing the number of filters (e.g., \( [32, 64, 128] \)) improved training accuracy but often led to marginal gains or even plateaus in validation accuracy.
#   - Example: Run 6 with filters [32, 64, 128]:
#     - Validation accuracy: **66.13%**.
#     - Validation loss: **0.1552**.
# 
# - **Loss Functions**:
#   - `binary_focal_crossentropy` slightly improved validation loss in some runs:
#     - Run 7: Validation loss **0.1838** with **66.67% validation accuracy**.
# 
# ---
# 
# 1. **Validation Accuracy**: Reached a maximum of **74%** in some configurations but often plateaued due to overfitting or suboptimal configurations, even with the reduced subset size.
# 2. **Subset Impact**: The smaller data size likely limited the model's ability to generalize effectively.
# 3. **Prediction Success**: The model correctly classified the test dog image with a probability of **99.92% confidence**.
# 4. **Next Steps**:
#    - Expand the subset size to include more data for better generalization.
#    - Apply data augmentation to simulate a larger dataset.
#    - Introduce regularization (e.g., dropout) and automated hyperparameter tuning to optimize results.
# 
# ---

# ---
# The model predicted a probability of 0.0992 for the test image, estimating a 9.92% chance of being a Cat. Since this is below the threshold of 0.5, the model classifies the image as a Dog. The closer the probability is to 0, the stronger the model's confidence in the "Dog" classification. Conversely, probabilities closer to 1 indicate greater confidence in the "Cat" classification.
# 
# The model achieved 100.0% accuracy on this single prediction. While this demonstrates the model correctly classified the test image, it’s important to consider that accuracy here is evaluated on just one image after training on a 75/25 split of 2,500 images (1,875 for training and 625 for validation).
# 
# For this result to truly reflect the model's performance:
# 
# * Generalization: The single prediction should be tested on additional unseen data to confirm consistent performance.
# * Dataset Size: With 2,500 images, the dataset is reasonably sized, but testing on a larger, more diverse dataset would provide better insight into real-world reliability.
# * Validation Set Performance: If the model performed well on the 25% validation set (625 images), it suggests the model has learned patterns effectively without overfitting.

# # BONUS (optional)

# 
# * Upload an image of your (or your friend's or family's) dog or cat and use your model to predict whether the image is a dog or cat.
# * Hint: you'll probably need to convert the image from color to grayscale.  OpenCV, pillow, and other libraries are your friend.

# In[43]:


image_path1 = '/content/que_es.jpg'

# Function to preprocess the uploaded image
def preprocess_image(image_path, target_size=(100, 100)):
    """
    Preprocess the image by converting it to grayscale, resizing to target size,
    and normalizing the pixel values.

    Args:
    - image_path: path to the image file
    - target_size: desired image size for prediction

    Returns:
    - Preprocessed image array
    """
    # Open the image with Pillow
    image = Image.open(image_path1)

    # Convert to grayscale
    image = image.convert('L')

    # Resize to 100x100
    image = image.resize(target_size)

    # Convert image to numpy array
    image_array = np.array(image)

    # Normalize pixel values to be between 0 and 1
    image_array = image_array / 255.0

    # Reshape the image to match model input (1, 100, 100, 1)
    image_array = image_array.reshape((1, 100, 100, 1))

    return image_array


def predict_image(image_path):
    # Preprocess the image
    processed_image = preprocess_image(image_path1)

    # Make a prediction
    prediction = model.predict(processed_image)

    # Interpret the prediction
    if prediction[0][0] < 0.5:
        prediction_label = "Dog"
    else:
        prediction_label = "Cat"

    return prediction_label, prediction[0][0]

# Upload your image here
image_path1 = '/content/que_es.jpg'  # Replace with the actual image path

# Get the prediction
label, probability = predict_image(image_path1)

# Display the image and the prediction result
image = Image.open(image_path1)
plt.imshow(image)
plt.title(f"Predicted: {label} (Probability: {probability:.4f})")
plt.axis('off')
plt.show()

# Print the prediction result
print(f"The image is predicted to be a: {label}")
print(f"Prediction probability: {probability:.4f}")


# In[44]:


# @title Outputs


# ```
# Model Fit using Training Set
# # model.fit(X_train, y_train, epochs=12, validation_data=(X_test, y_test))
# 
# Epoch 1/12
# 59/59 ━━━━━━━━━━━━━━━━━━━━ 15s 262ms/step - accuracy: 0.8180 - loss: 0.4055 - val_accuracy: 0.7115 - val_loss: 0.5762
# Epoch 2/12
# 59/59 ━━━━━━━━━━━━━━━━━━━━ 14s 143ms/step - accuracy: 0.8397 - loss: 0.3753 - val_accuracy: 0.7083 - val_loss: 0.5807
# Epoch 3/12
# 59/59 ━━━━━━━━━━━━━━━━━━━━ 11s 159ms/step - accuracy: 0.8259 - loss: 0.3957 - val_accuracy: 0.7051 - val_loss: 0.5883
# Epoch 4/12
# 59/59 ━━━━━━━━━━━━━━━━━━━━ 11s 173ms/step - accuracy: 0.8607 - loss: 0.3475 - val_accuracy: 0.7131 - val_loss: 0.5759
# Epoch 5/12
# 59/59 ━━━━━━━━━━━━━━━━━━━━ 9s 159ms/step - accuracy: 0.8342 - loss: 0.3413 - val_accuracy: 0.7179 - val_loss: 0.6015
# Epoch 6/12
# 59/59 ━━━━━━━━━━━━━━━━━━━━ 9s 143ms/step - accuracy: 0.8701 - loss: 0.3264 - val_accuracy: 0.7115 - val_loss: 0.6287
# Epoch 7/12
# 59/59 ━━━━━━━━━━━━━━━━━━━━ 14s 201ms/step - accuracy: 0.8710 - loss: 0.3012 - val_accuracy: 0.7356 - val_loss: 0.5919
# Epoch 8/12
# 59/59 ━━━━━━━━━━━━━━━━━━━━ 19s 171ms/step - accuracy: 0.8832 - loss: 0.2827 - val_accuracy: 0.7131 - val_loss: 0.6509
# Epoch 9/12
# 59/59 ━━━━━━━━━━━━━━━━━━━━ 11s 183ms/step - accuracy: 0.8981 - loss: 0.2592 - val_accuracy: 0.7276 - val_loss: 0.6490
# Epoch 10/12
# 59/59 ━━━━━━━━━━━━━━━━━━━━ 20s 175ms/step - accuracy: 0.8854 - loss: 0.2784 - val_accuracy: 0.7324 - val_loss: 0.6424
# Epoch 11/12
# 59/59 ━━━━━━━━━━━━━━━━━━━━ 11s 193ms/step - accuracy: 0.9097 - loss: 0.2410 - val_accuracy: 0.7003 - val_loss: 0.7187
# Epoch 12/12
# 59/59 ━━━━━━━━━━━━━━━━━━━━ 8s 144ms/step - accuracy: 0.9249 - loss: 0.2142 - val_accuracy: 0.7212 - val_loss: 0.7262
# ```

# ```
# Run 2, Filters 16,32, 64, 15 epochs, 25 batch_size, random_state=37, binary_crossentropy
# Epoch 1/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 30s 1s/step - accuracy: 0.5344 - loss: 0.6930 - val_accuracy: 0.5345 - val_loss: 0.6918
# Epoch 2/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 33s 1s/step - accuracy: 0.5200 - loss: 0.6931 - val_accuracy: 0.5345 - val_loss: 0.6931
# Epoch 3/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 21s 1s/step - accuracy: 0.5096 - loss: 0.6932 - val_accuracy: 0.5345 - val_loss: 0.6929
# Epoch 4/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 40s 1s/step - accuracy: 0.5334 - loss: 0.6929 - val_accuracy: 0.5345 - val_loss: 0.6922
# Epoch 5/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 21s 1s/step - accuracy: 0.5250 - loss: 0.6926 - val_accuracy: 0.5345 - val_loss: 0.6925
# Epoch 6/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 22s 1s/step - accuracy: 0.5115 - loss: 0.6930 - val_accuracy: 0.5345 - val_loss: 0.6928
# Epoch 7/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 38s 1s/step - accuracy: 0.5153 - loss: 0.6931 - val_accuracy: 0.5345 - val_loss: 0.6928
# Epoch 8/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 23s 1s/step - accuracy: 0.5455 - loss: 0.6928 - val_accuracy: 0.5345 - val_loss: 0.6924
# Epoch 9/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 20s 1s/step - accuracy: 0.5627 - loss: 0.6919 - val_accuracy: 0.5345 - val_loss: 0.6918
# Epoch 10/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 23s 1s/step - accuracy: 0.5061 - loss: 0.6936 - val_accuracy: 0.5345 - val_loss: 0.6925
# Epoch 11/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 40s 1s/step - accuracy: 0.5090 - loss: 0.6931 - val_accuracy: 0.5345 - val_loss: 0.6924
# Epoch 12/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 40s 1s/step - accuracy: 0.5172 - loss: 0.6929 - val_accuracy: 0.5345 - val_loss: 0.6922
# Epoch 13/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 41s 1s/step - accuracy: 0.4845 - loss: 0.6938 - val_accuracy: 0.5345 - val_loss: 0.6924
# Epoch 14/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 44s 1s/step - accuracy: 0.5067 - loss: 0.6932 - val_accuracy: 0.5345 - val_loss: 0.6919
# Epoch 15/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 22s 1s/step - accuracy: 0.5039 - loss: 0.6933 - val_accuracy: 0.5345 - val_loss: 0.6917
# <keras.src.callbacks.history.History at 0x7f1532ecef20>
# ```

# ```
# Run 3 Filters 4, 8, 16, 15 epochs, 25 batch, r_s 37, couldnt' use binary_focus_crossentropy
# Epoch 1/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 12s 528ms/step - accuracy: 0.4729 - loss: 0.6936 - val_accuracy: 0.5345 - val_loss: 0.6931
# Epoch 2/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 21s 560ms/step - accuracy: 0.5007 - loss: 0.6931 - val_accuracy: 0.5345 - val_loss: 0.6930
# Epoch 3/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 20s 507ms/step - accuracy: 0.5078 - loss: 0.6931 - val_accuracy: 0.5345 - val_loss: 0.6929
# Epoch 4/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 13s 684ms/step - accuracy: 0.5304 - loss: 0.6929 - val_accuracy: 0.5345 - val_loss: 0.6928
# Epoch 5/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 19s 555ms/step - accuracy: 0.4897 - loss: 0.6933 - val_accuracy: 0.5345 - val_loss: 0.6928
# Epoch 6/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 20s 559ms/step - accuracy: 0.5182 - loss: 0.6929 - val_accuracy: 0.5345 - val_loss: 0.6927
# Epoch 7/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 22s 625ms/step - accuracy: 0.5265 - loss: 0.6928 - val_accuracy: 0.5345 - val_loss: 0.6926
# Epoch 8/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 9s 485ms/step - accuracy: 0.5206 - loss: 0.6929 - val_accuracy: 0.5345 - val_loss: 0.6926
# Epoch 9/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 10s 479ms/step - accuracy: 0.5078 - loss: 0.6931 - val_accuracy: 0.5345 - val_loss: 0.6926
# Epoch 10/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 12s 589ms/step - accuracy: 0.4986 - loss: 0.6932 - val_accuracy: 0.5345 - val_loss: 0.6925
# Epoch 11/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 20s 589ms/step - accuracy: 0.5225 - loss: 0.6928 - val_accuracy: 0.5345 - val_loss: 0.6925
# Epoch 12/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 20s 553ms/step - accuracy: 0.5439 - loss: 0.6923 - val_accuracy: 0.5345 - val_loss: 0.6924
# Epoch 13/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 10s 551ms/step - accuracy: 0.5259 - loss: 0.6926 - val_accuracy: 0.5345 - val_loss: 0.6924
# Epoch 14/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 11s 584ms/step - accuracy: 0.5231 - loss: 0.6927 - val_accuracy: 0.5345 - val_loss: 0.6924
# Epoch 15/15
# 19/19 ━━━━━━━━━━━━━━━━━━━━ 9s 459ms/step - accuracy: 0.5129 - loss: 0.6929 - val_accuracy: 0.5345 - val_loss: 0.6923
# <keras.src.callbacks.history.History at 0x7f153187b700>
# ```

# ```
# Run 4 8, 16, 32, 15/25
# Epoch 1/15
# 15/15 ━━━━━━━━━━━━━━━━━━━━ 63s 127ms/step - accuracy: 0.5260 - loss: 0.6940 - val_accuracy: 0.4674 - val_loss: 0.6963
# Epoch 2/15
# 15/15 ━━━━━━━━━━━━━━━━━━━━ 3s 186ms/step - accuracy: 0.5141 - loss: 0.6894 - val_accuracy: 0.4674 - val_loss: 0.6962
# Epoch 3/15
# 15/15 ━━━━━━━━━━━━━━━━━━━━ 3s 213ms/step - accuracy: 0.5099 - loss: 0.6816 - val_accuracy: 0.4674 - val_loss: 0.6966
# Epoch 4/15
# 15/15 ━━━━━━━━━━━━━━━━━━━━ 2s 148ms/step - accuracy: 0.5545 - loss: 0.6697 - val_accuracy: 0.5000 - val_loss: 0.6864
# Epoch 5/15
# 15/15 ━━━━━━━━━━━━━━━━━━━━ 2s 147ms/step - accuracy: 0.6705 - loss: 0.6564 - val_accuracy: 0.4674 - val_loss: 0.7057
# Epoch 6/15
# 15/15 ━━━━━━━━━━━━━━━━━━━━ 2s 112ms/step - accuracy: 0.6473 - loss: 0.6360 - val_accuracy: 0.5761 - val_loss: 0.6771
# Epoch 7/15
# 15/15 ━━━━━━━━━━━━━━━━━━━━ 2s 113ms/step - accuracy: 0.6988 - loss: 0.5825 - val_accuracy: 0.5217 - val_loss: 0.6684
# Epoch 8/15
# 15/15 ━━━━━━━━━━━━━━━━━━━━ 2s 110ms/step - accuracy: 0.7748 - loss: 0.5625 - val_accuracy: 0.5870 - val_loss: 0.6339
# Epoch 9/15
# 15/15 ━━━━━━━━━━━━━━━━━━━━ 4s 181ms/step - accuracy: 0.7334 - loss: 0.5398 - val_accuracy: 0.5978 - val_loss: 0.6366
# Epoch 10/15
# 15/15 ━━━━━━━━━━━━━━━━━━━━ 4s 113ms/step - accuracy: 0.8097 - loss: 0.4883 - val_accuracy: 0.6630 - val_loss: 0.6071
# Epoch 11/15
# 15/15 ━━━━━━━━━━━━━━━━━━━━ 2s 111ms/step - accuracy: 0.7909 - loss: 0.4650 - val_accuracy: 0.6196 - val_loss: 0.6620
# Epoch 12/15
# 15/15 ━━━━━━━━━━━━━━━━━━━━ 2s 112ms/step - accuracy: 0.8284 - loss: 0.4078 - val_accuracy: 0.7065 - val_loss: 0.5822
# Epoch 13/15
# 15/15 ━━━━━━━━━━━━━━━━━━━━ 2s 113ms/step - accuracy: 0.8423 - loss: 0.3763 - val_accuracy: 0.6848 - val_loss: 0.5981
# Epoch 14/15
# 15/15 ━━━━━━━━━━━━━━━━━━━━ 2s 157ms/step - accuracy: 0.8236 - loss: 0.4186 - val_accuracy: 0.7065 - val_loss: 0.5891
# Epoch 15/15
# 15/15 ━━━━━━━━━━━━━━━━━━━━ 3s 169ms/step - accuracy: 0.8513 - loss: 0.3414 - val_accuracy: 0.6957 - val_loss: 0.6129
# ```

# ```
# Run 10 Filters 36,72, 120, 15 epochs, 25 batch, r_s 37
# Epoch 1/15
# 10/10 ━━━━━━━━━━━━━━━━━━━━ 7s 627ms/step - accuracy: 0.5114 - loss: 0.6999 - val_accuracy: 0.4915 - val_loss: 0.7909
# Epoch 2/15
# 10/10 ━━━━━━━━━━━━━━━━━━━━ 4s 396ms/step - accuracy: 0.5329 - loss: 0.7160 - val_accuracy: 0.5085 - val_loss: 0.6946
# Epoch 3/15
# 10/10 ━━━━━━━━━━━━━━━━━━━━ 4s 398ms/step - accuracy: 0.5341 - loss: 0.6911 - val_accuracy: 0.4915 - val_loss: 0.6942
# Epoch 4/15
# 10/10 ━━━━━━━━━━━━━━━━━━━━ 6s 480ms/step - accuracy: 0.5511 - loss: 0.6852 - val_accuracy: 0.4915 - val_loss: 0.7002
# Epoch 5/15
# 10/10 ━━━━━━━━━━━━━━━━━━━━ 4s 397ms/step - accuracy: 0.5637 - loss: 0.6718 - val_accuracy: 0.4915 - val_loss: 0.6961
# Epoch 6/15
# 10/10 ━━━━━━━━━━━━━━━━━━━━ 6s 539ms/step - accuracy: 0.6786 - loss: 0.6471 - val_accuracy: 0.5424 - val_loss: 0.7062
# Epoch 7/15
# 10/10 ━━━━━━━━━━━━━━━━━━━━ 9s 412ms/step - accuracy: 0.6958 - loss: 0.6263 - val_accuracy: 0.5085 - val_loss: 0.7680
# Epoch 8/15
# 10/10 ━━━━━━━━━━━━━━━━━━━━ 6s 631ms/step - accuracy: 0.7208 - loss: 0.5358 - val_accuracy: 0.5085 - val_loss: 0.7292
# Epoch 9/15
# 10/10 ━━━━━━━━━━━━━━━━━━━━ 8s 410ms/step - accuracy: 0.8148 - loss: 0.4933 - val_accuracy: 0.5932 - val_loss: 0.8160
# Epoch 10/15
# 10/10 ━━━━━━━━━━━━━━━━━━━━ 6s 595ms/step - accuracy: 0.7849 - loss: 0.4165 - val_accuracy: 0.6102 - val_loss: 0.7973
# Epoch 11/15
# 10/10 ━━━━━━━━━━━━━━━━━━━━ 4s 412ms/step - accuracy: 0.8748 - loss: 0.3754 - val_accuracy: 0.6271 - val_loss: 0.7922
# Epoch 12/15
# 10/10 ━━━━━━━━━━━━━━━━━━━━ 4s 401ms/step - accuracy: 0.8772 - loss: 0.3079 - val_accuracy: 0.5763 - val_loss: 0.8061
# Epoch 13/15
# 10/10 ━━━━━━━━━━━━━━━━━━━━ 7s 580ms/step - accuracy: 0.8454 - loss: 0.3437 - val_accuracy: 0.5763 - val_loss: 0.8572
# Epoch 14/15
# 10/10 ━━━━━━━━━━━━━━━━━━━━ 5s 473ms/step - accuracy: 0.9085 - loss: 0.2555 - val_accuracy: 0.5932 - val_loss: 0.8769
# Epoch 15/15
# 10/10 ━━━━━━━━━━━━━━━━━━━━ 5s 460ms/step - accuracy: 0.9435 - loss: 0.2065 - val_accuracy: 0.5424 - val_loss: 0.9337
# 
# ```

# ```
# Test Loss: 1.0266
# Test Accuracy: 0.6080
# 
# 
# 
# 
# ```

# ```
# 1/1 ━━━━━━━━━━━━━━━━━━━━ 0s 352ms/step
# 
# Test Loss: 0.6649, Test Accuracy: 0.6613
# Prediction (0: cat, 1: dog): [[0.9992652]]
# The model predicts the image is a: Dog
# Prediction Probability for Dog: 99.93%
# ```

# ```
# Reshaped image to 4D array with shape: (1, 224, 224, 3)
# 1/1 ━━━━━━━━━━━━━━━━━━━━ 0s 36ms/step
# Prediction (0: cat, 1: dog): [[0.4733072]]
# The model predicts the image is a: Cat
# Test Loss: 0.8019, Test Accuracy: 0.7280
# ```

# ```
# 1/1 ━━━━━━━━━━━━━━━━━━━━ 0s 120ms/step
# Test Loss: 0.5907, Test Accuracy: 0.7520
# Prediction (0: cat, 1: dog): [[0.50026464]]
# The model predicts the image is a: Dog
# Prediction Probability for Dog: 50.03%
# ```

# 
# * Communicate the results of your analysis.
# 
# 

# ```
# Evaluating the Model
# loss, accuracy = model.evaluate(X_test, y_test)
# print(f"Test Loss: {loss:.4f}")
# print(f"Test Accuracy: {accuracy:.4f}")
# The experiments conducted to optimize the model demonstrate that:
# ●
# The choice of loss function and the number of training epochs significantly impact model performance.
# ●
# Reducing the number of filters can improve generalization and prevent overfitting.
# ●
# Data splitting and the random state used during sampling influence the model's final accuracy.
# While the model shows promise in classifying images of cats and dogs, further tuning and experimentation with larger datasets could lead to even better performance.
# 
# 
# 
# ```

# ```
# !curl -O {url_X}
# 
# Run 1
#   % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
#                                  Dload  Upload   Total   Spent    Left  Speed
# 100  237M  100  237M    0     0  46.0M      0  0:00:05  0:00:05 --:--:-- 48.3M
# 
# Run 2
#  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
#                                  Dload  Upload   Total   Spent    Left  Speed
# 100  237M  100  237M    0     0  41.5M      0  0:00:05  0:00:05 --:--:-- 46.0M
# ```

# ```
# !curl -O {url_y}
# 
# Run 1
# % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
#                                  Dload  Upload   Total   Spent    Left  Speed
# 100 49948  100 49948    0     0   227k      0 --:--:-- --:--:-- --:--:--  227k
# 
# 
# Run 2
# % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
#                                  Dload  Upload   Total   Spent    Left  Speed
# 100 49948  100 49948    0     0   177k      0 --:--:-- --:--:-- --:--:--  177k
# 
# 
# Run 3
#  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
#                                  Dload  Upload   Total   Spent    Left  Speed
# 100 49948  100 49948    0     0   154k      0 --:--:-- --:--:-- --:--:--  155k
# 
# ```

# ```
# Model Fit Runs
# 
# Run 1, random_state 42, 3 layers (1 input, 1 hidden, 1 output), filters 32 & 64, binary_crossentropy loss, 8 epochs
# Epoch 1/8
# 24/24 ━━━━━━━━━━━━━━━━━━━━ 12s 411ms/step - accuracy: 0.4928 - loss: 0.7341
# Epoch 2/8
# 24/24 ━━━━━━━━━━━━━━━━━━━━ 11s 438ms/step - accuracy: 0.5476 - loss: 0.6891
# Epoch 3/8
# 24/24 ━━━━━━━━━━━━━━━━━━━━ 22s 502ms/step - accuracy: 0.5638 - loss: 0.6735
# Epoch 4/8
# 24/24 ━━━━━━━━━━━━━━━━━━━━ 19s 432ms/step - accuracy: 0.6928 - loss: 0.6242
# Epoch 5/8
# 24/24 ━━━━━━━━━━━━━━━━━━━━ 12s 495ms/step - accuracy: 0.6858 - loss: 0.5834
# Epoch 6/8
# 24/24 ━━━━━━━━━━━━━━━━━━━━ 19s 417ms/step - accuracy: 0.7379 - loss: 0.5506
# Epoch 7/8
# 24/24 ━━━━━━━━━━━━━━━━━━━━ 11s 452ms/step - accuracy: 0.7716 - loss: 0.4994
# Epoch 8/8
# 24/24 ━━━━━━━━━━━━━━━━━━━━ 21s 493ms/step - accuracy: 0.8112 - loss: 0.4557
# <keras.src.callbacks.history.History at 0x7f9269974820>
# ```

# ```
# Run 1 Filters 8, 16, 32, 10 epochs, binary_crossentropy, random_state=42
# Epoch 1/10
# 8/8 ━━━━━━━━━━━━━━━━━━━━ 8s 790ms/step - accuracy: 0.5161 - loss: 0.6937 - val_accuracy: 0.5085 - val_loss: 0.6931
# Epoch 2/10
# 8/8 ━━━━━━━━━━━━━━━━━━━━ 10s 763ms/step - accuracy: 0.4787 - loss: 0.6933 - val_accuracy: 0.4915 - val_loss: 0.6932
# Epoch 3/10
# 8/8 ━━━━━━━━━━━━━━━━━━━━ 13s 1s/step - accuracy: 0.5093 - loss: 0.6932 - val_accuracy: 0.4915 - val_loss: 0.6933
# Epoch 4/10
# 8/8 ━━━━━━━━━━━━━━━━━━━━ 8s 1s/step - accuracy: 0.5241 - loss: 0.6928 - val_accuracy: 0.4915 - val_loss: 0.6937
# Epoch 5/10
# 8/8 ━━━━━━━━━━━━━━━━━━━━ 8s 802ms/step - accuracy: 0.5224 - loss: 0.6924 - val_accuracy: 0.4915 - val_loss: 0.6953
# Epoch 6/10
# 8/8 ━━━━━━━━━━━━━━━━━━━━ 10s 762ms/step - accuracy: 0.5445 - loss: 0.6901 - val_accuracy: 0.4915 - val_loss: 0.6957
# Epoch 7/10
# 8/8 ━━━━━━━━━━━━━━━━━━━━ 11s 838ms/step - accuracy: 0.5073 - loss: 0.6939 - val_accuracy: 0.4915 - val_loss: 0.6935
# Epoch 8/10
# 8/8 ━━━━━━━━━━━━━━━━━━━━ 7s 879ms/step - accuracy: 0.5203 - loss: 0.6926 - val_accuracy: 0.4915 - val_loss: 0.6935
# Epoch 9/10
# 8/8 ━━━━━━━━━━━━━━━━━━━━ 7s 851ms/step - accuracy: 0.5119 - loss: 0.6928 - val_accuracy: 0.4915 - val_loss: 0.6940
# Epoch 10/10
# 8/8 ━━━━━━━━━━━━━━━━━━━━ 13s 1s/step - accuracy: 0.4927 - loss: 0.6940 - val_accuracy: 0.4915 - val_loss: 0.6947
# <keras.src.callbacks.history.History at 0x782781b3cc40>
# ```

# ```
# Run 6
# In sampling, changed random state= 37 (from 42).
# 4 layers (1 input, 2 hidden, 1 output)
# Filters 32, 64, 82
# 
# Epoch 1/8
# 24/24 ━━━━━━━━━━━━━━━━━━━━ 14s 533ms/step - accuracy: 0.4477 - loss: 0.1826
# Epoch 2/8
# 24/24 ━━━━━━━━━━━━━━━━━━━━ 21s 539ms/step - accuracy: 0.5055 - loss: 0.1728
# Epoch 3/8
# 24/24 ━━━━━━━━━━━━━━━━━━━━ 13s 554ms/step - accuracy: 0.5845 - loss: 0.1682
# Epoch 4/8
# 24/24 ━━━━━━━━━━━━━━━━━━━━ 19s 511ms/step - accuracy: 0.6448 - loss: 0.1569
# Epoch 5/8
# 24/24 ━━━━━━━━━━━━━━━━━━━━ 22s 583ms/step - accuracy: 0.6842 - loss: 0.1513
# Epoch 6/8
# 24/24 ━━━━━━━━━━━━━━━━━━━━ 15s 637ms/step - accuracy: 0.7082 - loss: 0.1431
# Epoch 7/8
# 24/24 ━━━━━━━━━━━━━━━━━━━━ 20s 603ms/step - accuracy: 0.6981 - loss: 0.1419
# Epoch 8/8
# 24/24 ━━━━━━━━━━━━━━━━━━━━ 21s 613ms/step - accuracy: 0.7850 - loss: 0.1219
# <keras.src.callbacks.history.History at 0x7f52485b0dc0>
# 
# ```

# ```
# Run 9 binary_focus_crossentropy loss, 8 epochs, 4 layers
# Epoch 1/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 5s 143ms/step - accuracy: 0.7989 - loss: 0.1191
# Epoch 2/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 7s 187ms/step - accuracy: 0.7863 - loss: 0.1194
# Epoch 3/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 9s 140ms/step - accuracy: 0.7866 - loss: 0.1124
# Epoch 4/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 7s 186ms/step - accuracy: 0.7978 - loss: 0.1117
# Epoch 5/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 5s 145ms/step - accuracy: 0.8525 - loss: 0.0955
# Epoch 6/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 7s 185ms/step - accuracy: 0.8226 - loss: 0.0958
# Epoch 7/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 5s 145ms/step - accuracy: 0.8318 - loss: 0.0941
# Epoch 8/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 12s 181ms/step - accuracy: 0.8734 - loss: 0.0775
# Epoch 9/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 5s 142ms/step - accuracy: 0.8708 - loss: 0.0766
# Epoch 10/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 7s 186ms/step - accuracy: 0.9123 - loss: 0.0662
# Epoch 11/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 9s 142ms/step - accuracy: 0.9094 - loss: 0.0650
# Epoch 12/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 10s 146ms/step - accuracy: 0.9055 - loss: 0.0636
# <keras.src.callbacks.history.History at 0x7f52d7aa7220>
# ```

# ```
# Run 273
# Epoch 1/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 7s 144ms/step - accuracy: 0.5198 - loss: 0.6902 - val_accuracy: 0.5173 - val_loss: 0.6905
# Epoch 2/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 7s 182ms/step - accuracy: 0.5449 - loss: 0.6881 - val_accuracy: 0.5520 - val_loss: 0.6888
# Epoch 3/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 5s 145ms/step - accuracy: 0.5675 - loss: 0.6813 - val_accuracy: 0.5867 - val_loss: 0.6809
# Epoch 4/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 13s 200ms/step - accuracy: 0.6008 - loss: 0.6638 - val_accuracy: 0.5440 - val_loss: 0.6935
# Epoch 5/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 6s 170ms/step - accuracy: 0.6196 - loss: 0.6406 - val_accuracy: 0.6000 - val_loss: 0.6660
# Epoch 6/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 9s 136ms/step - accuracy: 0.6638 - loss: 0.6108 - val_accuracy: 0.6267 - val_loss: 0.6469
# Epoch 7/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 7s 184ms/step - accuracy: 0.6750 - loss: 0.6056 - val_accuracy: 0.6560 - val_loss: 0.6432
# Epoch 8/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 5s 136ms/step - accuracy: 0.7114 - loss: 0.5761 - val_accuracy: 0.6027 - val_loss: 0.6764
# Epoch 9/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 7s 177ms/step - accuracy: 0.6928 - loss: 0.5810 - val_accuracy: 0.6240 - val_loss: 0.6715
# Epoch 10/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 9s 137ms/step - accuracy: 0.6864 - loss: 0.5688 - val_accuracy: 0.6587 - val_loss: 0.6409
# Epoch 11/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 7s 183ms/step - accuracy: 0.7295 - loss: 0.5478 - val_accuracy: 0.6560 - val_loss: 0.6245
# Epoch 12/12
# 36/36 ━━━━━━━━━━━━━━━━━━━━ 5s 138ms/step - accuracy: 0.7229 - loss: 0.5441 - val_accuracy: 0.5520 - val_loss: 0.8229
# <keras.src.callbacks.history.History at 0x7a40b188ebc0>
# ```

# ```
# Model Summary Output
# 
# Run 1
# Model: "functional_13"
# ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━┓
# ┃ Layer (type)                         ┃ Output Shape                ┃         Param # ┃
# ┡━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━┩
# │ input_layer_3 (InputLayer)           │ (None, 100, 100, 1)         │               0 │
# ├──────────────────────────────────────┼─────────────────────────────┼─────────────────┤
# │ conv_input (Conv2D)                  │ (None, 98, 98, 32)          │             320 │
# ├──────────────────────────────────────┼─────────────────────────────┼─────────────────┤
# │ max_pooling2d_6 (MaxPooling2D)       │ (None, 49, 49, 32)          │               0 │
# ├──────────────────────────────────────┼─────────────────────────────┼─────────────────┤
# │ hidden1 (Conv2D)                     │ (None, 47, 47, 64)          │          18,496 │
# ├──────────────────────────────────────┼─────────────────────────────┼─────────────────┤
# │ max_pooling2d_7 (MaxPooling2D)       │ (None, 23, 23, 64)          │               0 │
# ├──────────────────────────────────────┼─────────────────────────────┼─────────────────┤
# │ flatten_3 (Flatten)                  │ (None, 33856)               │               0 │
# ├──────────────────────────────────────┼─────────────────────────────┼─────────────────┤
# │ output (Dense)                       │ (None, 1)                   │          33,857 │
# └──────────────────────────────────────┴─────────────────────────────┴─────────────────┘
#  Total params: 158,021 (617.27 KB)
#  Trainable params: 52,673 (205.75 KB)
#  Non-trainable params: 0 (0.00 B)
#  Optimizer params: 105,348 (411.52 KB)
#  ```

# ```
# Run 5 Compiled model with loss = 'binary_focal_crossentropy'
# 
# 
# Model: "sequential"
# ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━┓
# ┃ Layer (type)                         ┃ Output Shape                ┃         Param # ┃
# ┡━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━┩
# │ conv_input (Conv2D)                  │ (None, 98, 98, 32)          │             320 │
# ├──────────────────────────────────────┼─────────────────────────────┼─────────────────┤
# │ max_pooling2d (MaxPooling2D)         │ (None, 49, 49, 32)          │               0 │
# ├──────────────────────────────────────┼─────────────────────────────┼─────────────────┤
# │ hidden1 (Conv2D)                     │ (None, 47, 47, 64)          │          18,496 │
# ├──────────────────────────────────────┼─────────────────────────────┼─────────────────┤
# │ max_pooling2d_1 (MaxPooling2D)       │ (None, 23, 23, 64)          │               0 │
# ├──────────────────────────────────────┼─────────────────────────────┼─────────────────┤
# │ hidden2 (Conv2D)                     │ (None, 21, 21, 82)          │          47,314 │
# ├──────────────────────────────────────┼─────────────────────────────┼─────────────────┤
# │ max_pooling2d_2 (MaxPooling2D)       │ (None, 10, 10, 82)          │               0 │
# ├──────────────────────────────────────┼─────────────────────────────┼─────────────────┤
# │ flatten (Flatten)                    │ (None, 8200)                │               0 │
# ├──────────────────────────────────────┼─────────────────────────────┼─────────────────┤
# │ output (Dense)                       │ (None, 1)                   │           8,201 │
# └──────────────────────────────────────┴─────────────────────────────┴─────────────────┘
#  Total params: 222,995 (871.08 KB)
#  Trainable params: 74,331 (290.36 KB)
#  Non-trainable params: 0 (0.00 B)
#  Optimizer params: 148,664 (580.72 KB)
# ```

# ```
# Run 4,891
# Model: "sequential"
# ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━┓
# ┃ Layer (type)                         ┃ Output Shape                ┃         Param # ┃
# ┡━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━┩
# │ conv_input (Conv2D)                  │ (None, 98, 98, 8)           │              80 │
# ├──────────────────────────────────────┼─────────────────────────────┼─────────────────┤
# │ max_pooling2d (MaxPooling2D)         │ (None, 49, 49, 8)           │               0 │
# ├──────────────────────────────────────┼─────────────────────────────┼─────────────────┤
# │ hidden1 (Conv2D)                     │ (None, 47, 47, 16)          │           1,168 │
# ├──────────────────────────────────────┼─────────────────────────────┼─────────────────┤
# │ max_pooling2d_1 (MaxPooling2D)       │ (None, 23, 23, 16)          │               0 │
# ├──────────────────────────────────────┼─────────────────────────────┼─────────────────┤
# │ hidden2 (Conv2D)                     │ (None, 21, 21, 32)          │           4,640 │
# ├──────────────────────────────────────┼─────────────────────────────┼─────────────────┤
# │ max_pooling2d_2 (MaxPooling2D)       │ (None, 10, 10, 32)          │               0 │
# ├──────────────────────────────────────┼─────────────────────────────┼─────────────────┤
# │ flatten (Flatten)                    │ (None, 3200)                │               0 │
# ├──────────────────────────────────────┼─────────────────────────────┼─────────────────┤
# │ output (Dense)                       │ (None, 1)                   │           3,201 │
# └──────────────────────────────────────┴─────────────────────────────┴─────────────────┘
#  Total params: 27,269 (106.52 KB)
#  Trainable params: 9,089 (35.50 KB)
#  Non-trainable params: 0 (0.00 B)
#  Optimizer params: 18,180 (71.02 KB)
#  ```

# ```
# Accuracy Evaluation Output
# 
# Run 1
# 8/8 ━━━━━━━━━━━━━━━━━━━━ 2s 224ms/step - accuracy: 0.6191 - loss: 0.6985
# Test Loss: 0.7023
# Test Accuracy: 0.6160
# ```

# ```
# Run 2
# 8/8 ━━━━━━━━━━━━━━━━━━━━ 1s 126ms/step - accuracy: 0.6240 - loss: 0.6830
# Test Loss: 0.6785
# Test Accuracy: 0.6280
# ```

# ```
# Run 3
# Added a third layer and changed filters in 2nd layer=32, 3rd layer= 64
# ```

# ```
# Run 4
# 8/8 ━━━━━━━━━━━━━━━━━━━━ 1s 137ms/step - accuracy: 0.6510 - loss: 0.6592
# Test Loss: 0.6958
# Test Accuracy: 0.6400
# ```

# ```
# Run 5  (Loss = 'binary_focal_crossentropy' and 3 layers)
# 8/8 ━━━━━━━━━━━━━━━━━━━━ 2s 195ms/step - accuracy: 0.6279 - loss: 0.1854
# Test Loss: 0.1779
# Test Accuracy: 0.6440
# ```

# ```
# Run 6 (same as 5 & changed random state= 37 in sampling)
# 12/12 ━━━━━━━━━━━━━━━━━━━━ 3s 208ms/step - accuracy: 0.6794 - loss: 0.1500
# Test Loss: 0.1552
# Test Accuracy: 0.6613
# ```

# ```
# Run 7 Decreased filters to 16, 32, 48
# 12/12 ━━━━━━━━━━━━━━━━━━━━ 1s 83ms/step - accuracy: 0.6445 - loss: 0.1948
# Test Loss: 0.1838
# Test Accuracy: 0.6667
# ```

# ```
# Run 8 Decreased filters to 8, 16, 32
# 12/12 ━━━━━━━━━━━━━━━━━━━━ 1s 44ms/step - accuracy: 0.6545 - loss: 0.1583
# Test Loss: 0.1538
# Test Accuracy: 0.6800
# ```

# ```
# Run 9 Increased epochs to 12
# 12/12 ━━━━━━━━━━━━━━━━━━━━ 1s 47ms/step - accuracy: 0.6815 - loss: 0.2208
# Test Loss: 0.2033
# Test Accuracy: 0.6933
# ```

# ```
# Run 10 back to binary_crossentropy, random state 37, 4 layers, 8, 16, 32 and 12 epochs
# 12/12 ━━━━━━━━━━━━━━━━━━━━ 1s 68ms/step - accuracy: 0.6739 - loss: 0.6105
# Test Loss: 0.6022
# Test Accuracy: 0.6747
# ```

# ```
# Run 867,550 this sum beee- ehhhssss
# Test Loss: 0.8229
# Test Accuracy: 0.5520
# ```
