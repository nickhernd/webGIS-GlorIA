FROM python:3.9
WORKDIR /app
COPY python-services/requirements.txt .
RUN pip install -r requirements.txt
COPY python-services .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
