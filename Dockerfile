# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory
WORKDIR /opt/elltwo

# Install any needed packages specified in requirements.txt
COPY requirements.txt .
RUN pip install --trusted-host pypi.python.org -r requirements.txt

# Make port 5000 available to the world outside this container
EXPOSE 5000

# Copy application code
COPY *.py .
COPY console .
COPY static static
COPY templates templates

# Load in sample content
COPY testing testing
RUN ["python", "console", "backup", "load", "testing"]

# Run when the container launches
CMD ["python", "-u", "server.py", "--ip=0.0.0.0", "--theme=white", "--demo"]
