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
COPY static/css static/css
COPY static/fonts static/fonts
COPY static/img static/img
COPY static/js static/js
COPY static/katex/dist static/katex/dist
COPY static/libs static/libs
COPY static/themes static/themes
COPY static/favicon static/favicon
COPY templates templates

# Load in cookie secret (SECRET_KEY and SECURITY_PASSWORD_SALT)
COPY auth.toml .

# Load in sample content
COPY testing testing
RUN ["python", "db_populate.py"]

# Run when the container launches
CMD ["python", "-u", "ax.py", "--ip=0.0.0.0", "--port=80", "--debug"]
