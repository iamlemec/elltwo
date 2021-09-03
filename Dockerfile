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
COPY demo.sh .
COPY static static
COPY templates templates
COPY testing testing

# Demo entry point
CMD ["bash", "demo.sh"]
