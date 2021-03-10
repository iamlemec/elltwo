# Use an official Python runtime as a parent image
FROM python:3.9-alpine

# Set the working directory
WORKDIR /opt/fuzzy

# Install base packages
RUN apk --update add bash git make gcc g++ musl-dev

# Install any needed packages specified in requirements.txt
COPY requirements.txt .
RUN pip install --trusted-host pypi.python.org -r requirements.txt

# Make port 80 available to the world outside this container
EXPOSE 80

# Copy application code
COPY *.py .
COPY static static
COPY templates templates

# Run when the container launches
CMD ["python", "-u", "ax.py", "--port=80"]
