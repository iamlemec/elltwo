# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory
WORKDIR /opt/elltwo

# Install any needed packages specified in requirements.txt
COPY requirements.txt .
RUN pip install --trusted-host pypi.python.org -r requirements.txt

# Make port 80 available to the world outside this container
EXPOSE 80

# Copy application code
COPY *.py .
COPY console .
COPY static static
COPY templates templates

# Load in cookie secret (SECRET_KEY and SECURITY_PASSWORD_SALT)
COPY auth.toml .

# Load in sample content
COPY testing testing
RUN ["python", "console", "backup", "load", "testing"]

# Run when the container launches
CMD ["python", "-u", "server.py", "--ip=0.0.0.0", "--port=80", "--auth=auth.toml", "--theme=white", "--reindex"]
